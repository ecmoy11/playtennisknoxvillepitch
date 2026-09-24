# Play Tennis Knoxville — redesign prototype

A working, clickable prototype of the proposed redesign. Plain HTML and CSS, no build step, no dependencies. It matches the Figma page "Website Redesign v2 — new brand".

**This is a prototype, not the finished site.** Some links are placeholders and some numbers are marked `[PRICE]` or `[DATES]` because they are not published anywhere on the current site.

## What's in here

```
index.html      Home
register.html   Calendar — every program open right now
juniors.html    Juniors section hub
program.html    Junior Lessons & Clinics detail
assets/
  styles.css    All the styling. Design tokens are at the top in :root
  nav.js        Mobile menu toggle + the demo filter buttons
  logo.png      The new wordmark
.nojekyll       Tells GitHub Pages to serve the files as-is
```

## Putting it on GitHub Pages

1. Make a new repository on GitHub. Public, no README (this folder has one).
2. Upload everything in this folder to the root of the repo. Drag and drop works: on the empty repo page, click **uploading an existing file**, then drag the four HTML files, the `assets` folder, `.nojekyll` and this README.
3. Go to **Settings → Pages**.
4. Under **Source**, pick **Deploy from a branch**. Set branch to `main` and folder to `/ (root)`. Save.
5. Wait about a minute, then refresh. The URL appears at the top of that page and looks like `https://yourusername.github.io/reponame/`.

That link is what you send Deidra. It works on her phone.

If you would rather do it from the terminal:

```bash
cd path/to/this/folder
git init
git add .
git commit -m "Redesign prototype"
git branch -M main
git remote add origin https://github.com/YOURNAME/REPONAME.git
git push -u origin main
```

Then do steps 3 to 5 above.

## Turning the hero video on

Right now the hero shows a court graphic standing in for footage. Once you have the clip:

1. Export the video as `hero.mp4`, 1080p, 16:9, 20 seconds, no audio track. Keep it under about 8 MB so it loads fast.
2. Export one frame as `hero-poster.jpg`, same dimensions.
3. Put both in `assets/`.
4. Open `index.html`, find the block that starts `<!-- TO TURN ON THE VIDEO`, delete the three placeholder divs below it (`hero__glow`, the `svg`, and `hero__ball`), and uncomment the `<video>` block.

The scrim over the video is already set up so the headline and the two doors stay readable. If your footage is very bright, raise the scrim opacity in `styles.css` under `.hero__scrim`.

## Changing the brand colours

Everything comes from custom properties at the top of `assets/styles.css`:

```css
--navy: #003A7C;
--navy-deep: #002B5C;
--chartreuse: #C9D91C;
--cream: #F8F8F0;
```

Change them there and the whole site follows.

## Notes on how it is built

- The program card on the home page and the rows on the register page carry the same six fields every time: status, audience, name, when, where, cost. That consistency is the point. It is what makes the content maintainable by one person.
- The register page is a list, not a table, so it collapses cleanly on a phone. It also maps directly onto what a Squarespace summary block does natively, which is the intended build target.
- The filter buttons on the register page are a demo. They filter the rows already on the page. In a real build the programs would come from a collection.
- Fonts load from Google Fonts: Archivo for everything, Instrument Serif for the one pull quote.
- Placeholders left deliberately: adult clinic prices, JTT season dates and JTT prices. None of those are published on the current site.
