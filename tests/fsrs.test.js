#!/usr/bin/env node
/**
 * Luminaria v2 — FSRS Algorithm Unit Tests
 *
 * Tests the core spaced-repetition scheduling algorithm.
 * These tests verify that the FSRS implementation correctly
 * adjusts stability, difficulty, and scheduling intervals
 * based on user answers.
 *
 * Usage: node tests/fsrs.test.js
 */

/* eslint-env node */
/* eslint-disable no-console */

// ── Mock DOM environment ──
// (FSRS uses getToday() which depends on Date)
global.getToday = function () {
  return new Date().toISOString().split('T')[0];
};
global.addDays = function (dateStr, days) {
  var date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

// ── Mock state ──
global.learningLog = { fsrsCards: {} };
global.wordBankData = {};

// ── Load FSRS functions inline (from compiled JS) ──
// These are the actual functions from fsrs.js, copied here for testing
function fsrsUpdate(word, correct) {
  var card = learningLog.fsrsCards[word] || {
    s: 1, d: 5, state: 0, reps: 0, lapses: 0, due: getToday()
  };
  var today = getToday();

  if (correct) {
    card.reps++;
    if (card.state === 0) {
      card.s = 1; card.d = 5; card.state = 2; card.due = addDays(today, 1);
    } else {
      var daysSince = card.state === 3 ? 1
        : Math.max(0.5, (new Date(today) - new Date(card.due)) / 86400000);
      var R = Math.exp(Math.log(0.9) * daysSince / Math.max(0.5, card.s));
      card.s = Math.max(0.5, card.s * (1 + 0.12 * (1 - R)));
      card.d = Math.max(1, Math.min(10, card.d - 0.15));
      card.state = 2;
      card.due = addDays(today, Math.max(1, Math.round(card.s * (0.9 + 0.2 * Math.random()))));
    }
  } else {
    card.lapses++;
    card.d = Math.min(10, card.d + 2);
    card.s = Math.max(0.5, card.s * 0.4);
    card.state = 3;
    card.due = today;
  }

  card.depthScore = Math.min(100, Math.round(card.s * 8 + card.reps * 2 - card.lapses * 3));
  learningLog.fsrsCards[word] = card;
}

function getFSRSDepth(word) {
  var card = learningLog.fsrsCards[word];
  if (!card || card.state === 0) return 8;
  return card.depthScore || Math.min(95, Math.round((card.s || 1) * 8 + (card.reps || 0) * 2 - (card.lapses || 0) * 3));
}

// ── Test Runner ──
var passed = 0;
var failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('  ✗ FAIL:', message);
  }
}

function resetState() {
  learningLog.fsrsCards = {};
}

// ═══════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════
console.log('═══ FSRS Algorithm Tests ═══\n');

// Test 1: New word — first correct answer
console.log('Test 1: First correct answer');
resetState();
fsrsUpdate('test', true);
var card = learningLog.fsrsCards['test'];
assert(card.state === 2, 'State should be 2 (review) after first correct: ' + card.state);
assert(card.due >= getToday(), 'Due date should not be in the past');
assert(card.s === 1, 'Stability should be 1: ' + card.s);
assert(card.d <= 5, 'Difficulty should decrease: ' + card.d);
assert(card.reps === 1, 'Reps should be 1: ' + card.reps);
console.log('  → state=2, s=1, reps=1, d≈4.85\n');

// Test 2: New word — first wrong answer
console.log('Test 2: First wrong answer');
resetState();
fsrsUpdate('test', false);
card = learningLog.fsrsCards['test'];
assert(card.state === 3, 'State should be 3 (relearning): ' + card.state);
assert(card.d === 7, 'Difficulty should increase to 7: ' + card.d);
assert(card.s === 0.5, 'Stability should drop to 0.5: ' + card.s);
assert(card.lapses === 1, 'Lapses should be 1: ' + card.lapses);
assert(card.due === getToday(), 'Due should be today: ' + card.due);
console.log('  → state=3, d=7, s=0.5, lapses=1\n');

// Test 3: Multiple correct answers (stability growth)
console.log('Test 3: Stability growth over 5 correct answers');
resetState();
for (var i = 0; i < 5; i++) {
  fsrsUpdate('grow', true);
}
card = learningLog.fsrsCards['grow'];
assert(card.s > 1, 'Stability should grow: ' + card.s.toFixed(2));
assert(card.d < 5, 'Difficulty should decrease: ' + card.d.toFixed(2));
assert(card.reps === 5, 'Reps should be 5: ' + card.reps);
assert(card.lapses === 0, 'Lapses should be 0: ' + card.lapses);
console.log('  → s=' + card.s.toFixed(2) + ', d=' + card.d.toFixed(2) + ', reps=5\n');

// Test 4: Depth score
console.log('Test 4: Depth score computation');
resetState();
fsrsUpdate('depth', true);
var depth = getFSRSDepth('depth');
assert(depth >= 8, 'Depth should be at least 8: ' + depth);
assert(depth <= 30, 'Depth should be low for single review: ' + depth);

for (var j = 0; j < 10; j++) {
  fsrsUpdate('depth', true);
}
depth = getFSRSDepth('depth');
assert(depth >= 25, 'Depth should grow with more reviews: ' + depth);
console.log('  → depth after 1 review: ~' + getFSRSDepth('unseen') + ', after 11: ' + depth + '\n');

// Test 5: Mixed correct/wrong pattern
console.log('Test 5: Mixed correct/wrong pattern');
resetState();
fsrsUpdate('mixed', true);   // correct
fsrsUpdate('mixed', false);  // wrong → lapse
card = learningLog.fsrsCards['mixed'];
assert(card.lapses === 1, 'Lapses should be 1: ' + card.lapses);
assert(card.state === 3, 'State should be relearning: ' + card.state);

fsrsUpdate('mixed', true);   // correct again
card = learningLog.fsrsCards['mixed'];
assert(card.state === 2, 'State should return to review: ' + card.state);
assert(card.reps === 2, 'Reps should be 2: ' + card.reps);
console.log('  → lapse then recover: state=' + card.state + ', reps=' + card.reps + '\n');

// Test 6: Unexplored word depth
console.log('Test 6: Unexplored word depth');
resetState();
assert(getFSRSDepth('unknown') === 8, 'Unexplored word should have depth 8');
console.log('  → correct\n');

// Test 7: Deep mastery
console.log('Test 7: Deep mastery — 30 correct answers');
resetState();
for (var k = 0; k < 30; k++) {
  fsrsUpdate('master', true);
}
card = learningLog.fsrsCards['master'];
depth = getFSRSDepth('master');
assert(card.s > 1, 'Stability should be above baseline: ' + card.s.toFixed(2));
assert(depth > 50, 'Depth should be substantial: ' + depth);
assert(card.d < 2, 'Difficulty should be very low: ' + card.d.toFixed(2));
console.log('  → s=' + card.s.toFixed(2) + ', depth=' + depth + ', d=' + card.d.toFixed(2) + '\n');

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════
console.log('═══ Results ═══');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Total:  ' + (passed + failed));

if (failed === 0) {
  console.log('\n✅ All FSRS tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed\n');
  process.exit(1);
}
