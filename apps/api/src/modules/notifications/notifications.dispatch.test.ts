import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchNewPick } from './templates.ts';
import type {
  EmailMessage,
  Notifier,
  PushMessage,
} from './notifier.interface.ts';

/** Provider-mocked Notifier that records every call. */
function fakeNotifier(): Notifier & {
  emails: EmailMessage[];
  pushes: PushMessage[];
} {
  const emails: EmailMessage[] = [];
  const pushes: PushMessage[] = [];
  return {
    name: 'fake',
    emails,
    pushes,
    async sendEmail(msg) {
      emails.push(msg);
    },
    async sendPush(msg) {
      pushes.push(msg);
    },
  };
}

const pick = {
  tipsterId: 't1',
  market: 'Match Odds',
  selection: 'Home',
  oddsAtPick: 2.1,
};

test('dispatchNewPick: emails and pushes each recipient with the digest template', async () => {
  const notifier = fakeNotifier();
  const recipients = [
    { userId: 'u1', email: 'a@example.com' },
    { userId: 'u2', email: 'b@example.com' },
  ];

  await dispatchNewPick(notifier, pick, recipients);

  assert.equal(notifier.emails.length, 2);
  assert.equal(notifier.pushes.length, 2);

  // Correct recipient + template subject/body on the email channel.
  assert.deepEqual(
    notifier.emails.map((e) => e.to).sort(),
    ['a@example.com', 'b@example.com'],
  );
  for (const email of notifier.emails) {
    assert.equal(email.subject, 'New pick posted');
    assert.equal(email.body, 'Match Odds: Home @ 2.1');
  }

  // Push channel targets user ids with the same template content.
  assert.deepEqual(
    notifier.pushes.map((p) => p.userId).sort(),
    ['u1', 'u2'],
  );
  for (const push of notifier.pushes) {
    assert.equal(push.title, 'New pick posted');
    assert.equal(push.body, 'Match Odds: Home @ 2.1');
  }
});

test('dispatchNewPick: no recipients means no notifier calls', async () => {
  const notifier = fakeNotifier();
  await dispatchNewPick(notifier, pick, []);
  assert.equal(notifier.emails.length, 0);
  assert.equal(notifier.pushes.length, 0);
});
