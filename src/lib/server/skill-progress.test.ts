import { describe, expect, it } from "vitest";
import { summarizeSkillProgress } from "./skill-progress";

describe("skill progress", () => {
    it("counts unlearned catalog skills as unmaxed", () => {
        expect(summarizeSkillProgress([
            { current_level: 5, max_level: 5 },
            { current_level: 2, max_level: 5 },
            { current_level: 0, max_level: 3 },
        ])).toEqual({
            total: 3,
            learned: 2,
            maxed: 1,
            unmaxed: 2,
            allMaxed: false,
        });
    });

    it("reports the catalog as mastered only when every skill is maxed", () => {
        expect(summarizeSkillProgress([
            { current_level: 5, max_level: 5 },
            { current_level: 3, max_level: 3 },
        ])).toEqual({
            total: 2,
            learned: 2,
            maxed: 2,
            unmaxed: 0,
            allMaxed: true,
        });
    });

    it("does not treat an empty catalog as mastered", () => {
        expect(summarizeSkillProgress([]).allMaxed).toBe(false);
    });
});
