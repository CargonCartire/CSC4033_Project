require('dotenv').config();
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.DYNAMODB_TABLE || 'User_Info_Table';
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set in .env (at least 32 characters).');
  process.exit(1);
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('PORT must be a number between 1 and 65535.');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' })
);

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ---------- helpers ----------
// Table schema: Email (partition key), User_Name, Password (bcrypt hash), Affinty_Points (number)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const getUser = async (email) => {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { Email: email } }));
  return Item;
};

function setSession(res, email) {
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies.session, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Not signed in.' });
  }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// ---------- API ----------
app.post('/api/signup', authLimiter, async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body || {};

    if (![username, email, password, confirmPassword].every((v) => typeof v === 'string')) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (!USERNAME_RE.test(username)) {
      return res
        .status(400)
        .json({ error: 'Username must be 3-20 characters: letters, numbers, underscores.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: 'Password must be 8-72 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            Email: cleanEmail,
            User_Name: username,
            Password: passwordHash,
            Affinty_Points: 0, // new accounts start at 0
          },
          // Fails if an account with this email already exists.
          ConditionExpression: 'attribute_not_exists(Email)',
        })
      );
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      throw err;
    }

    setSession(res, cleanEmail);
    res.status(201).json({ ok: true, username, affinityPoints: 0 });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUser(cleanEmail);

    const valid = await bcrypt.compare(
      password,
      user && typeof user.Password === 'string' ? user.Password : DUMMY_HASH
    );
    if (!user || !valid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    setSession(res, cleanEmail);
    // Retrieve the user's affinity points on login.
    res.json({
      ok: true,
      username: user.User_Name,
      affinityPoints: user.Affinty_Points ?? 0,
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Always reads the latest values from DynamoDB so points stay current.
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await getUser(req.user.email);
    if (!user) return res.status(401).json({ error: 'Not signed in.' });
    res.json({
      username: user.User_Name,
      email: user.Email,
      affinityPoints: user.Affinty_Points ?? 0,
    });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
  });
  res.json({ ok: true });
});

// ---------- static pages ----------
const servePage = (file) => (req, res, next) => {
  res.sendFile(path.join(__dirname, file), (err) => {
    if (err) next(err);
  });
};

app.get('/', servePage('index.html'));
app.get('/index.html', servePage('index.html'));
app.get('/signup.html', servePage('signup.html'));
app.get('/dashboard.html', servePage('dashboard.html'));
app.get('/style.css', servePage('style.css'));

const serverless = require('serverless-http');
exports.handler = serverless(app);
