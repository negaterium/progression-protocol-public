import { describe, expect, it } from "vitest";
import { countDailyCompletions } from "./quest-utils";

describe("Daily dashboard progress", () => {
    it("counts only daily quests completed on the report day", () => {
        const quests = [
            { frequency: "Daily", status: "Complete", completed_at: "2026-10-10T10:00:00Z" },
            { frequency: "Daily", status: "Complete", completed_at: "2026-10-09T10:00:00Z" },
            { frequency: "Weekly", status: "Complete", completed_at: "2026-10-10T10:00:00Z" },
            { frequency: "Once", status: "Complete", completed_at: "2026-10-10T10:00:00Z" },
            { frequency: "Daily", status: "Active", completed_at: null },
        ];
        expect(countDailyCompletions(quests, "2026-10-10")).toBe(1);
    });
    it("includes an optimistic completion and handles missing or invalid timestamps", () => {
        const quests = [
            { frequency: "Daily", status: "Complete", completed_at: "2026-10-10T23:59:59Z" },
            { frequency: "Daily", status: "Complete", completed_at: "invalid" },
            { frequency: "Daily", status: "Complete" },
        ];
        expect(countDailyCompletions(quests, "2026-10-10")).toBe(1);
        expect(countDailyCompletions(quests, "2026-10-11")).toBe(0);
    });
});
