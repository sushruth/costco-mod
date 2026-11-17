# Design rules

The script makes costco.com dense in information and light to look at, and it should still look like Costco. Each rule below came from a correction during review. The cart is the reference page: every other page should look like it belongs with the cart.

## Space

- A gap has to separate two things. Remove any gap that doesn't, whether it sits left, right, below or inside a box. Moving a gap from one side to the other doesn't fix it; change the layout.
- After tightening, check the result isn't crowded. Give a crowded spot a little room back, and keep a small gap between cards.
- A row that holds one small action wastes a line. Put the action on a line that already exists.
- Spacing follows one rhythm per block: one size for body text and one for small print, with even gaps between rows.

## Grouping

- Show what belongs together with a shared outline or a split section inside the card. Don't use left indents.
- Put a thing where its scope is. If a detail covers every option, such as a billing address, it sits apart from the options, not under one of them.
- Put details of one thing on one line ("visa ending in 8179 · Expires 02/29"). Separate choices each get their own line.
- Every box, border, background and shadow has to earn its place. Don't use double borders or heavy shadows.

## Alignment

- Center everything vertically inside chips, buttons and rows: icons, text, switches and badges.
- Continuation lines start where the text above starts. They don't start under the checkbox or the icon.
- When the same element appears on two pages, it matches: the header, footer, search bar, separators, font sizes and heights. Treat Costco's React pages as the reference.

## Controls

- Show one primary button per view. Other actions are ghost or icon buttons that take emphasis on hover.
- A chip holds its related actions inside it. For example, the wallet chip is logo, balance, switch and +. Don't leave a separate button floating beside it.
- A control that does nothing reads as disabled. A $0 wallet looks switched off and greyed out, even when Costco has it on.
- A split chip beats a chip with loose text beside it. Use one for a date next to its delivery type.
- Clicking a control never makes the control disappear. If it opens something, it stays visible and shows that state.
- Drop a radio button when there's nothing to choose between.

## Text

- Turn text into an icon when the icon is clear, using Phosphor icons. Its `title` and `aria-label` keep the old words. Prices, dates and counts stay text.
- Cut redundant wording: repeated notes, labels that repeat what's beside them, and a unit price that equals the total at quantity 1.
- Every line makes sense on its own. "Arrives Nov 25" beats "what dates?". Name things from the page's own data. Don't use hard-coded word lists or guesses.
- Content the user has to read, such as consent or legal text, shows in full all the time. Never hide it behind hover-to-expand.
- Small labels and headers stay small and regular weight.

## Prices and badges

- A price has a fixed, predictable spot, such as bottom-left in a tile or the right edge in a row. Never mix it into running text.
- Badges are pills: a plain 50% `border-radius`, a slight border and a fixed line height so the text sits centered. Don't use `clip-path` shapes.
- Photos are rounded with `overflow:hidden`, and that clipping does the corner work for anything placed on them.

## Costco's look

- Use a 4px radius on cards, Costco blue `#005DAB`, regular-weight titles, `|` separators and 12px grey meta text.
- Use the tokens in `src/core/base.css` (`--cm-blue`, `--cm-ink-3`, `--cm-line`, …) and avoid one-off colors.
- Dark Reader has to render it cleanly: use border longhands and no gradients.

## Every size and every case

- Phones have no hover. Anything shown only on hover needs a tap or always-visible substitute below 1024px.
- Design for N items, not just the two on screen. Ask what happens with seven.
- When one spot gets fixed, fix the same problem everywhere: other pages, other card types, desktop and phone.
- When something looks bad in a screenshot, redesign it. Never hide it to get a cleaner shot.

## Honesty

- Show only what Costco's data supports. When Costco doesn't break a number down, say what's known and don't claim a split.
- Everything the script learns stays in the browser.
