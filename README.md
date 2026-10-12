# Play Tennis Knoxville — redesign prototype

A working, clickable prototype of the proposed redesign. Plain HTML and CSS, no build step, no dependencies. It matches the Figma page "Website Redesign v2 — new brand".

**This is a prototype, not the finished site.** Some links are placeholders and some numbers are marked `[PRICE]` or `[DATES]` because they are not published anywhere on the current site.

## What's in here

```
index.html      Home
register.html   Calendar — every program open right now
juniors.html    Juniors section hub
program.html    Junior Lessons & Clinics detail
404.html        Page not found, with the interactive tennis ball
assets/
  styles.css    All the styling. Design tokens are at the top in :root
  nav.js        Mobile menu toggle + the demo filter buttons
  logo.png      The new wordmark
  ball404.js    The 404 ball: three.js scene, physics, grab and throw, sound
  ball/         Ball textures (color, normal, roughness) and the static fallback image
  vendor/       three.js r170, kept in the repo so the page has no CDN dependency
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

## Swapping the hero photo, or moving to video

The hero is now split: navy panel with the headline on the left, photo on the right. To change the photo, replace `assets/hero.jpg`. Anything roughly 1200 x 1150 or larger works, and `object-fit: cover` handles the cropping.

If you later want the right half to be video instead of a still, replace the `<img class="hero__photo">` in `index.html` with:

```html
<video class="hero__photo" autoplay muted loop playsinline poster="assets/hero.jpg">
  <source src="assets/hero.mp4" type="video/mp4">
</video>
```

No CSS changes needed, `.hero__photo` already handles the sizing. Keep the clip under 20 seconds and around 8 MB, and keep `hero.jpg` in place as the poster so there is always a fallback.

## The Contact Us menu

The header button opens a dropdown with four rows: call Tyson, call West Hills, email, Facebook. Click outside or press Escape to close it. Phone numbers are `tel:` links, so they dial straight from a phone.

To change what is in it, edit the `.connect__menu` block in the header of each page. The behaviour lives at the bottom of `assets/nav.js`.

## Changing the brand colours

Everything comes from custom properties at the top of `assets/styles.css`:

```css
--navy: #003A7C;
--navy-deep: #002B5C;
--chartreuse: #C9D91C;
--cream: #F8F8F0;
```

Change them there and the whole site follows.

## The 404 page

GitHub Pages serves `404.html` automatically for any URL that does not exist, so a mistyped link lands there. The "0" is a 3D tennis ball. On a computer, moving the mouse over it knocks it out and it drops to the floor. On a phone, tap it. Grab it and throw it, tap it to make it hop, and drag it back into the gap (or click the dashed outline) to put it back. Keyboard users can press Enter on the zero to do the same.

- Every number worth tuning is in `CONFIG` at the top of `assets/ball404.js`: gravity, bounce, friction, squash, throw speed.
- The floor is the invisible `.court__baseline` element. Move it in CSS and the physics follows.
- People with reduced motion turned on, or browsers without WebGL, see the static ball image and nothing moves.
- Add `?debug` to the URL to expose the ball state as `window.__ball` in the console.
- The bounce sound is `assets/ball/bounce.mp3`: 12 single hits cut from an Epidemic Sound indoor hard-court recording. Each impact plays one hit, hard to soft depending on speed. The offsets are in `SPRITE` in `ball404.js`.
- Weight: three.js is about 170KB gzipped, the textures about 200KB. It only loads on this page.

## Notes on how it is built

- The program card on the home page and the rows on the register page carry the same six fields every time: status, audience, name, when, where, cost. That consistency is the point. It is what makes the content maintainable by one person.
- The register page is a list, not a table, so it collapses cleanly on a phone. It also maps directly onto what a Squarespace summary block does natively, which is the intended build target.
- The filter buttons on the register page are a demo. They filter the rows already on the page. In a real build the programs would come from a collection.
- Fonts load from Google Fonts: Archivo for everything, Instrument Serif for the one pull quote.
- Placeholders left deliberately: adult clinic prices, JTT season dates and JTT prices. None of those are published on the current site.
