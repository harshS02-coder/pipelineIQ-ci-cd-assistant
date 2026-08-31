import mongoose from 'mongoose';

/**
 * ============================================================================
 * USER MODEL — GitHub-Authenticated Users
 * ============================================================================
 *
 * This model stores users who have connected their GitHub account via OAuth.
 * The access token is stored ENCRYPTED using AES-256-GCM (see encryption.js).
 *
 * WHY WE DON'T STORE THE TOKEN IN PLAINTEXT:
 * A GitHub access token with "repo" scope gives full read/write access to
 * all of a user's repositories. If our database is ever compromised (via
 * injection, backup leak, or insider threat), plaintext tokens would let
 * the attacker access every user's GitHub repos. Encryption at rest ensures
 * the tokens are useless without the ENCRYPTION_KEY from our environment.
 *
 * FIELD EXPLANATIONS:
 * - githubId:       GitHub's numeric user ID (immutable, unlike usernames)
 * - githubUsername: The user's GitHub login (e.g., "octocat")
 * - avatarUrl:     URL to their GitHub profile picture
 * - accessToken:   The encrypted GitHub OAuth token (hex ciphertext)
 * - accessTokenIv: The initialization vector used during encryption
 * - accessTokenTag: The GCM authentication tag for integrity verification
 *
 * NOTE: We use githubId as the unique identifier (not username) because
 * GitHub usernames can be changed, but user IDs are permanent.
 * ============================================================================
 */

const userSchema = new mongoose.Schema(
  {
    // GitHub's permanent numeric ID — the primary lookup key
    githubId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    // GitHub login/username — for display purposes
    githubUsername: {
      type: String,
      required: true,
      index: true,
    },

    // Profile picture URL from GitHub
    avatarUrl: {
      type: String,
      default: '',
    },

    // ---- ENCRYPTED ACCESS TOKEN (3 fields) ----
    // These three fields together allow us to decrypt the GitHub OAuth token.
    // See src/utils/encryption.js for the encrypt/decrypt implementation.

    // The AES-256-GCM ciphertext of the access token (hex-encoded)
    accessToken: {
      type: String,
      required: true,
    },

    // The initialization vector (IV) used during encryption (hex-encoded, 24 chars)
    // Each encryption uses a unique IV to ensure identical tokens produce different ciphertext
    accessTokenIv: {
      type: String,
      required: true,
    },

    // The GCM authentication tag (hex-encoded, 32 chars)
    // Used during decryption to verify the ciphertext hasn't been tampered with
    accessTokenTag: {
      type: String,
      required: true,
    },

    // Timestamp of when the user first connected their GitHub account
    connectedAt: {
      type: Date,
      default: Date.now,
    },

    // Timestamp of the last time the user's token was refreshed or re-authenticated
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'users',
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

export default mongoose.model('User', userSchema);
