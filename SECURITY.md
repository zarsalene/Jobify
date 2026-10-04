# Security

## Principles
- **Secrets live only on the server.** The mobile app contains no AI, email or storage credentials. `.env` files are never committed; `.env.example` holds placeholders only.
- **Short-lived access tokens, rotating refresh tokens.** Refresh tokens are stored hashed. Reuse of a spent token revokes all of that user's tokens.
- **Passwords** are hashed with Argon2. Login responds identically for unknown email and wrong password.
- **Mobile token storage** uses the Android Keystore and iOS Keychain through `expo-secure-store`.
- **Least data to the AI.** Only task-relevant profile and job context is sent to a model.
- **No sensitive logging:** passwords, tokens, API keys, CV contents, private emails and full prompts are never logged.
- **Human approval** is required before any public or destructive action.

## Third-party platforms
Jobify does not store LinkedIn or Indeed passwords and does not bypass CAPTCHAs, rate limits or authentication. It uses official APIs, supported OAuth, public data, user-provided URLs and deep links.

## Reporting a vulnerability
Please report security issues privately to the maintainers instead of opening a public issue. (Add a contact address before launch.)
