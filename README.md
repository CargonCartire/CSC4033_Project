# DynamoDB Login / Create Account

Express app with a login page (email + password) and a create-account page
(username, email, password, confirm password). Users are stored in AWS DynamoDB.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and set `JWT_SECRET`. The template's region and
   table name match the app defaults. The AWS SDK uses its standard credential
   provider chain: use a local AWS profile for development or an IAM role when
   running on AWS. Do not put AWS credentials in this file.
3. Create the table (one time). Skip this if `User_Info_Table` already exists
   with a string partition key named `Email`:
   ```
   npm run create-table
   ```
   The command waits for a new table to become active and checks the partition
   key of an existing table.
4. Start the app and open http://localhost:3000:
   ```
   npm start
   ```

## How it works

- **Table**: `User_Info_Table` (us-east-2), partition key `Email` (string).
- Each account is one item: `Email`, `User_Name`, `Password` (bcrypt hash) and
  `Affinty_Points` (number). The attribute is spelled `Affinty_Points` to match the
  existing table.
- On account creation `Affinty_Points` is set to `0`. On login the current value is
  read from DynamoDB and returned, and the dashboard shows it (re-read each load).
- Emails are unique (a signup with an existing email is rejected). Usernames are
  not checked for uniqueness; that would need a secondary index on `User_Name`.
- Passwords are hashed with bcrypt (cost 12); plaintext is never stored.
- Login sets an httpOnly, SameSite=Lax cookie containing a 7-day JWT.
- Auth endpoints are rate limited, and login returns the same error for a wrong
  email or wrong password.

## IAM permissions needed

The application needs `dynamodb:GetItem` and `dynamodb:PutItem`. The one-time
table setup command additionally needs `dynamodb:DescribeTable` and
`dynamodb:CreateTable`. Restrict the resource ARN to your account, region, and
table name:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DescribeTable",
      "dynamodb:CreateTable"
    ],
    "Resource": "arn:aws:dynamodb:us-east-2:180536780886:table/User_Info_Table"
  }]
}
```

## Before production

- Serve over HTTPS and set `NODE_ENV=production` (makes the cookie `Secure`).
- Add CSRF protection if you add state-changing routes beyond these.
- Consider email verification and password reset.
