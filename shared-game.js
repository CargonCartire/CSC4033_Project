'use strict';

const STATS = ['food', 'water', 'bath', 'sleep'];
const SHARED_KEY = '__shared_bulldog__';

function newDog(num = 1) {
  return { num, max: 100, drain: 1, health: 100, age: 0,
    food: 50, water: 50, bath: 50, sleep: 50, sickLvl: 0, isDead: false, tick: 0 };
}

function checkDog(dog) {
  dog.sickLvl = STATS.filter(s => dog[s] / dog.max < 0.15 || dog[s] / dog.max > 0.85).length;
  dog.isDead = dog.health <= 0;
  return dog;
}

// One server clock; idle time is applied on the next read or action.
// A neglected dog dies after a few hundred ticks, so even long absences are bounded.
function advance(record, now) {
  const dog = { ...record.dog };
  const elapsed = Math.max(0, Math.floor((now - record.updatedAt) / 1000));
  for (let i = 0; i < elapsed && !dog.isDead; i++) {
    dog.tick++;
    if (dog.tick % 300 === 0) {
      dog.age++;
      dog.max *= 1.15;
      dog.drain = Math.min(4, dog.drain + 0.5);
    }
    if (dog.tick % 6 === 0) {
      for (const s of STATS) dog[s] = Math.max(0, dog[s] - dog.drain);
    }
    checkDog(dog);
    dog.health = dog.sickLvl > 0
      ? Math.max(0, dog.health - dog.sickLvl)
      : Math.min(dog.max, dog.health + 1);
    checkDog(dog);
  }
  return { ...record, dog, updatedAt: record.updatedAt + elapsed * 1000 };
}

function registerSharedGame(app, options) {
  const { ddb, TABLE, requireAuth, GetCommand, PutCommand, TransactWriteCommand } = options;
  const clock = options.clock || Date.now;
  const read = async email => (await ddb.send(new GetCommand({
    TableName: TABLE, Key: { Email: email }, ConsistentRead: true
  }))).Item;
  const conflict = err => err.name === 'ConditionalCheckFailedException' ||
    err.name === 'TransactionCanceledException' || err.name === 'TransactionConflictException';
  const fail = (status, message) => Object.assign(new Error(message), { status });

  async function getRecord() {
    const record = await read(SHARED_KEY);
    if (record) return record;
    const initial = { Email: SHARED_KEY, kind: 'shared-game', version: 0,
      dog: newDog(), updatedAt: clock() };
    try {
      await ddb.send(new PutCommand({ TableName: TABLE, Item: initial,
        ConditionExpression: 'attribute_not_exists(Email)' }));
      return initial;
    } catch (err) {
      if (!conflict(err)) throw err;
      return read(SHARED_KEY);
    }
  }

  const publicState = (record, user) => ({ dog: record.dog,
    version: record.version, affinityPoints: user.Affinty_Points ?? 0 });

  async function operate(email, action, expectedNum) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const user = await read(email);
      if (!user || typeof user.Password !== 'string') throw fail(401, 'Not signed in.');
      const old = await getRecord();
      const now = clock();
      const next = advance(old, now);
      if (action) {
        if (expectedNum !== next.dog.num) throw fail(409, 'The dog changed. Please try again.');
        if (action === 'newDog') {
          if (!next.dog.isDead) throw fail(409, 'This dog is still alive.');
          next.dog = newDog(next.dog.num + 1);
          next.updatedAt = now;
        } else {
          if (next.dog.isDead) throw fail(409, 'This dog has died. Load the latest state.');
          if ((user.Last_Bulldog_Action ?? 0) > now - 1000) {
            throw fail(429, 'Please wait a second before another action.');
          }
          for (const s of STATS) {
            next.dog[s] = Math.min(next.dog.max, Math.max(0, next.dog[s] + (s === action ? 10 : -2)));
          }
          checkDog(next.dog);
        }
      }
      if (!action && next.updatedAt === old.updatedAt) return publicState(next, user);
      next.version = old.version + 1;
      const put = { TableName: TABLE, Item: next,
        ConditionExpression: '#version = :version',
        ExpressionAttributeNames: { '#version': 'version' },
        ExpressionAttributeValues: { ':version': old.version } };
      try {
        if (action && action !== 'newDog') {
          // Dog care and this player's point commit together, or neither does.
          await ddb.send(new TransactWriteCommand({ TransactItems: [
            { Put: put },
            { Update: { TableName: TABLE, Key: { Email: email },
              UpdateExpression: 'SET Last_Bulldog_Action = :now ADD Affinty_Points :point',
              ConditionExpression: 'attribute_exists(Password) AND (attribute_not_exists(Last_Bulldog_Action) OR Last_Bulldog_Action <= :cutoff)',
              ExpressionAttributeValues: { ':now': now, ':point': 1, ':cutoff': now - 1000 } } }
          ] }));
          user.Affinty_Points = (user.Affinty_Points ?? 0) + 1;
        } else {
          await ddb.send(new PutCommand(put));
        }
        return publicState(next, user);
      } catch (err) {
        if (!conflict(err)) throw err;
      }
    }
    throw fail(409, 'The game is busy. Please try again.');
  }

  function endpoint(actionRequest) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        const { action, dogNum } = req.body || {};
        if (actionRequest && (!STATS.concat('newDog').includes(action) || !Number.isSafeInteger(dogNum))) {
          return res.status(400).json({ error: 'A valid action and dogNum are required.' });
        }
        res.json(await operate(req.user.email, actionRequest ? action : null, dogNum));
      } catch (err) {
        if (!err.status) console.error('Shared Bulldog error:', err);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save the game. Please try again.' });
      }
    };
  }
  app.get('/api/game', requireAuth, endpoint(false));
  app.post('/api/game/action', requireAuth, endpoint(true));
}

module.exports = { registerSharedGame, newDog, advance, checkDog, SHARED_KEY };
