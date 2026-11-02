// The background tests again, with the v1 detector.
process.env.DETECTOR = "v1";
await import("./background.test.mjs");
