// This file is a compatibility shim.
// All quest actions have been split into focused modules under ./quests/
// Consumers importing from "@/app/actions/quests" continue to work unchanged.
export * from "./quests/index";
