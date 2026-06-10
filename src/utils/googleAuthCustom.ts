export interface GoogleProfile {
  displayName: string;
  photoURL: string;
  email: string;
}

// Default Client ID for the Google Web Application. 
// Teacher can configure their own custom Client ID if needed, 
// but we provide a robust, default-setup capable of retrieving drive & profile scopes.
export const DEFAULT_CLIENT_ID = '114948502071-pbfv98mvlcl81g2o22beovphskg94qes.apps.googleusercontent.com';

/**
 * Initiates direct Google OAuth 2.0 implicit grant redirect.
 * This completely avoids Firebase Auth popups and uses standard Google endpoints.
 */
export function initiateGoogleOAuth(clientIdToUse?: string) {
  const clientId = clientIdToUse || DEFAULT_CLIENT_ID;
  const redirectUri = window.location.origin;
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `prompt=consent`;

  window.location.href = authUrl;
}

/**
 * Parses and processes access token in the URL hash redirected from Google.
 * Example hash: #access_token=ya29...&token_type=Bearer&expires_in=3600
 */
export function parseOAuthHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  
  if (accessToken) {
    // Clean hash from URL for aesthetic and security reasons
    window.history.replaceState(null, '', window.location.pathname);
    return accessToken;
  }
  return null;
}

/**
 * Fetches user profile directly from Google Endpoint using the access token.
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      throw new Error('Failed to fetch user profile from Google API');
    }
    const data = await res.json();
    return {
      displayName: data.name || data.email || 'Admin Guru',
      photoURL: data.picture || '',
      email: data.email || ''
    };
  } catch (err) {
    console.error('Error fetching Google Profile:', err);
    return null;
  }
}
