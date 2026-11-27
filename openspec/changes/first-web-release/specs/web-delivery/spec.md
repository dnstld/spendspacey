# Web delivery delta

## MODIFIED Requirements

### Requirement: Hosted authentication uses exact registered origins

Production PKCE SHALL use the current-origin application callback, with exact Google and Supabase settings and the local callback retained. New-user signups SHALL remain disabled throughout production configuration and smoke testing. Existing provider scopes, enrolled-user controls, authentication methods, and current-session sign-out SHALL be preserved.

#### Scenario: Enrolled PM signs in and out online
- **WHEN** the PM signs in from production in Chrome on the iPhone
- **THEN** OAuth returns to the same registered Pages origin, the minimal authenticated identity screen appears, and callback parameters are scrubbed
- **AND** current-session sign-out returns to the login screen without revoking independent sessions
- **AND** the callback and application return use Brazilian Portuguese

#### Scenario: Provider configuration is reviewed
- **WHEN** the PM configures the final production origin
- **THEN** Google's authorized JavaScript origin is `https://<project>.pages.dev`
- **AND** Google's authorized redirect URI remains `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
- **AND** Supabase Site URL is `https://<project>.pages.dev`
- **AND** Supabase Redirect URLs retain `http://localhost:5173/auth/callback` and add exact `https://<project>.pages.dev/auth/callback`, without preview wildcards
- **AND** the client derives its callback from the current origin instead of hardcoding localhost
- **AND** signups remain disabled throughout configuration and smoke testing, with no new Auth project or enrollment broadening
- **AND** unexpected access findings are referred to the PM without automatic deletion or policy changes
