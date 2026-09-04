const promises = [
  {
    head: 'Free shipping, no minimum',
    body: 'Insured, on every order. A $149 gig bag ships free the same as a $2,400 PRS.',
  },
  {
    head: 'Out in one business day',
    body: "Packed and shipped insured. Local pickup in Ohio if you'd rather play it first.",
  },
  {
    head: 'Answers the same day',
    body: 'More photos, measurements, or a video or audio demo — ask before you buy.',
  },
  {
    head: 'Payment plans',
    body: "PayPal or credit card, or split it up. Email me and we'll work it out.",
  },
  {
    head: 'Trades and cash offers',
    body: 'I take trade-ins and I buy guitars outright. Send photos and what you want for it.',
  },
];

export default function TrustBar() {
  return (
    <section className="order-5 md:order-none">
      {/* Phone: numbered rows rather than the tinted cell grid, which at 375px stacked
          five bordered boxes on top of each other. */}
      <div className="px-5 pt-8 md:hidden">
        <h2 className="font-heading text-[26px] leading-none">What you get, every single time</h2>
        <ol className="m-0 mt-4 list-none border-t border-foreground/15 p-0">
          {promises.map((promise, i) => (
            <li
              key={promise.head}
              className="grid grid-cols-[auto_1fr] gap-3.5 border-b border-foreground/12 py-4"
            >
              <span className="font-heading text-[15px] leading-none text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-base font-semibold leading-[1.3]">{promise.head}</p>
                <p className="mt-1 text-sm leading-[1.45] text-foreground/65">{promise.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="hidden border-y border-foreground/14 bg-foreground/[0.022] md:block">
        <div className="mx-auto max-w-[1320px] px-5 py-[clamp(30px,4vw,44px)]">
          <h2 className="label-mono mb-[clamp(22px,3vw,30px)] font-medium text-primary">
            What you get, every single time
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(200px,1fr))] border-r border-b border-foreground/14 p-0">
            {promises.map(promise => (
              <li
                key={promise.head}
                className="border-t border-l border-foreground/14 px-5 pt-5 pb-[22px]"
              >
                <p className="mb-[7px] font-heading text-[17px] tracking-[0.01em]">{promise.head}</p>
                <p className="text-sm leading-[1.5] text-foreground/68">{promise.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
