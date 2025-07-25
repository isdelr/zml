interface FaqItem {
  question: string;
  answer: string;
}

const faqItems: FaqItem[] = [
  {
    question: "How do rounds work?",
    answer: "Each league has rounds with a specific theme. Members submit one song that fits the theme. After the submission period ends, a voting period begins where everyone votes on the submissions.",
  },
  {
    question: "How does voting work?",
    answer: "Voting is anonymous. You're given a set number of 'upvotes' and 'downvotes' to distribute among the submissions (you can't vote for your own song). The song with the highest net score at the end wins the round!",
  },
  {
    question: "Can I join more than one league?",
    answer: "Absolutely! You can be a member of multiple leagues at the same time. Your 'Active Rounds' page will show you all rounds that are currently open for submissions or voting across all your leagues.",
  },
  {
    question: "Can I submit songs from Spotify or YouTube?",
    answer: "Yes! You can submit by uploading an audio file or by simply pasting a link from Spotify or YouTube. We'll automatically fetch the song details and artwork for you.",
  },
];

export function HomeFAQ() {
  return (
    <section id="faq" className="container mx-auto max-w-4xl py-12 md:py-24">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold md:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-4 text-muted-foreground">
          Have questions? We have answers. If you can&apos;t find what you are looking for, feel free to reach out.
        </p>
      </div>
      <div className="space-y-4">
        {faqItems.map((item) => (
          <div key={item.question} className="rounded-lg border bg-card/50 p-6">
            <h3 className="font-semibold text-foreground">{item.question}</h3>
            <p className="mt-2 text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}