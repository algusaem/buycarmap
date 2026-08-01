import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    /**
     * Epoch ms at which this session was established. Compared against the
     * user's `passwordChangedAt` to revoke sessions issued before a password
     * change — the only way to invalidate a stateless JWT server-side.
     */
    pwdAt?: number;
    /**
     * Epoch ms of the last database revalidation. Bounds the revocation check
     * to one query per session per interval instead of one per request.
     */
    checkedAt?: number;
  }
}
