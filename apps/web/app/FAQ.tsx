'use client';

import { useState } from 'react';

const questions = [
  {
    question: 'How are picks verified?',
    answer:
      'Every pick is locked before kickoff with a timestamped record. Results are settled automatically after the event.',
  },
  {
    question: 'Can tipsters edit previous picks?',
    answer:
      'No. Once a pick is locked, the record cannot be changed. Performance history remains transparent.',
  },
  {
    question: 'What is closing line value?',
    answer:
      'Closing line value measures whether a tipster consistently beats the final market price before kickoff.',
  },
  {
    question: 'How do subscriptions work?',
    answer:
      'Each tipster creates their own subscription offering. Users choose tipsters based on verified performance.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '2rem 1.5rem',
      }}
    >
      <h2>Frequently asked questions</h2>

      {questions.map((item, index) => (
        <div
          key={item.question}
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '1rem 0',
          }}
        >
          <button
            onClick={() => setOpen(open === index ? null : index)}
            style={{
              background: 'none',
              border: 0,
              cursor: 'pointer',
              color: 'inherit',
              width: '100%',
              textAlign: 'left',
              fontSize: '1rem',
            }}
          >
            {item.question}
          </button>

          {open === index && (
            <p
              style={{
                color: 'var(--muted)',
                lineHeight: 1.6,
              }}
            >
              {item.answer}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}