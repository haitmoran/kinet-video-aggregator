import assert from "node:assert/strict";
import { getStarBySlug, getStarsForVideo, starProfiles } from "../data/stars.ts";
import { videos } from "../data/videos.ts";

assert.equal(starProfiles.length, 8, "Expected eight prototype profiles");
assert.equal(new Set(starProfiles.map((star) => star.slug)).size, starProfiles.length, "Star slugs must be unique");

for (const star of starProfiles) {
  assert.equal(getStarBySlug(star.slug), star, `Slug lookup failed for ${star.slug}`);
  assert.ok(star.featuredCredits.length > 0, `${star.name} needs at least one featured credit`);
}

for (const video of videos) {
  const assignedStars = getStarsForVideo(video.id);
  assert.equal(assignedStars.length, 2, `${video.id} must have exactly two stars`);
  assert.notEqual(assignedStars[0].slug, assignedStars[1].slug, `${video.id} stars must be distinct`);
}

console.log(`Star data smoke test passed: ${videos.length} videos, exactly two stars each.`);
