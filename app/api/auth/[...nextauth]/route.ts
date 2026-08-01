import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

// `authOptions` lives in lib/auth/options.ts, not here: server components and
// server actions need it for `getServerSession`, and importing it from a route
// file would drag the NextAuth handler into every one of those modules.
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
