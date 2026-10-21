import { STORY_RESPONSES } from '@/data/story-responses';
import { askedLine } from '@/lib/v2/story-figures';

/**
 * G7 right of reply (D12). One slot per company that was sent a letter: the reply verbatim with the date it arrived, or the
 * fixed line "We asked [Company] for comment on [date] and will add any response here."
 */
export default function StoryResponse({ companies }: { companies: { name: string }[] }) {
  return (
    <ul className="space-y-4">
      {companies.map((c) => {
        const reply = STORY_RESPONSES[c.name];
        return (
          <li key={c.name} data-response={c.name}>
            {reply ? (
              <>
                <p className="font-sans text-[15px] font-bold">
                  {c.name} replied on {reply.received}. Its response, verbatim:
                </p>
                <blockquote className="mt-2 space-y-3 border-l-4 border-line pl-4">
                  {reply.text.split(/\n\s*\n/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </blockquote>
              </>
            ) : (
              <p>{askedLine(c.name)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
