import { getAuthenticatedUser } from "@/lib/auth-utils";
import { isDeveloperUserId } from './developer-access';

/** Privilege comes exclusively from server configuration, never profile fields. */
export async function getDeveloperUser() {
    const user = await getAuthenticatedUser();
    if (!isDeveloperUserId(user.id)) {
        throw new Error("ACCESS DENIED: Developer authorization required.");
    }
    return user;
}
