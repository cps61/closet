# Closet: Virtual Closet & Outfit Builder

A free web app you add to your iPhone home screen. It opens full screen like a
regular app, works offline, and keeps your closet only on your phone.

**Costs nothing, ever:** free hosting (GitHub Pages), free on-device background
removal, and no App Store, Apple Developer account or subscriptions.

## Put it on your iPhone

1. Create a free account at **github.com**.
2. Click **New repository**. Name it `closet`, choose **Public**, and click
   **Create repository**.
3. Click **uploading an existing file**. Drag in everything from this folder:
   `index.html`, `manifest.webmanifest`, `sw.js`, and the `css`, `js` and `icons`
   folders. The `.claude` folder isn't needed. Click **Commit changes**.
4. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`,
   then click **Save**. After a minute or so your app is live at
   `https://YOUR-USERNAME.github.io/closet/`.
5. On your iPhone, open that address in **Safari**. Tap **Share → Add to Home
   Screen**, then open Closet from your home screen.

The code is public on GitHub, but your photos and closet are not. They never
leave your phone.

**Updating:** upload the changed files to the same repository again. The app
picks up the new version the next time you open it.

## How the AI works

Add one photo or many at once: clothes laid flat, or photos of you wearing them.

- **Photo of you wearing an outfit:** each piece (top, pants, shoes, hat, bag,
  scarf) is cut out separately. Tap a piece to leave it out.
- **Photo of one item:** the item is cut out from the background.
- **Every piece is identified and named automatically**, e.g. "Navy hoodie" in
  Tops or "White sneakers" in Shoes. You can fix the name or category before saving.

Everything runs on the phone, offline after the first use, and no photo is ever
uploaded. The first photo downloads three free AI models once (~185 MB, so use
Wi-Fi):

| Job | Model | License |
|---|---|---|
| Remove background | [IMG.LY background-removal](https://github.com/imgly/background-removal-js) (ISNet) | AGPL |
| Find each garment on a person | [SegFormer clothes](https://huggingface.co/Xenova/segformer_b2_clothes) | MIT |
| Identify the type (hoodie, jeans…) | [Marqo-FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP) | Apache 2.0 |

The text side of FashionSigLIP is run once ahead of time (see
`tools/embed-labels.html`), and its output is saved in
`models/label-embeddings.json`, so the phone only downloads the image side.
To add a clothing type, add it to `js/labels.js`, run
`python tools/dev_server.py`, open http://localhost:8123/tools/embed-labels.html
and upload the regenerated `models/label-embeddings.json`.

## Good to know

- **Your closet lives on this phone only.** Deleting the home-screen app or
  clearing Safari's website data erases it. A backup/export feature is planned.
- Parts of a garment hidden in the photo (an arm across a shirt, a bag strap)
  show up as gaps in the cutout. A clean photo of the item fixes that later.
- To try changes on a computer, run `python tools/dev_server.py` in this folder
  and open http://localhost:8123.

## Structure

```
index.html            App shell: screens, tab bar, sheets
manifest.webmanifest  Home-screen name, icon, full-screen mode
sw.js                 Offline support
css/app.css           Design system, light/dark themes, animations
js/
├── app.js                 Startup, tab navigation
├── closet.js              Gallery grid, filters, item detail, delete
├── add-item.js            Import flow: photo queue → AI → review → save
├── pieces.js              One photo → cut-out, recognized, named pieces
├── clothing-ai.js         Garment segmentation + type recognition models
├── background-removal.js  Background removal model
├── labels.js              Clothing types the app recognizes
├── images.js              Photo prep, masks, trimming, color naming
├── db.js                  On-device storage (IndexedDB)
├── settings.js            Appearance (System / Light / Dark)
├── ui.js                  Sheets, category chips
└── categories.js          Categories and canvas layer order
models/label-embeddings.json  Precomputed clothing-type text embeddings
tools/                Dev server + embedding generator (not needed on GitHub)
icons/                Home-screen icons
```

## Next milestones

- [ ] Outfit canvas: drag, pinch to resize, rotate, layer order, save/name outfits
- [ ] Backup & restore (export your closet to a file in Files/iCloud Drive)
- [ ] Manual edge refinement (erase/restore brush using the stored original)
- [ ] Edit an item's name and category
