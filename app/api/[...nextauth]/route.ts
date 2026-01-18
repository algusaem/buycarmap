import NextAuth from "next-auth";
import type { AuthOptions } from "next-auth";

export const authOptions: AuthOptions = {
  providers: [
    // Configure providers here
  ],
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
