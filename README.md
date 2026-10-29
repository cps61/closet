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

## How background removal works

The first time you add an item, the app downloads an AI model (~80 MB, so use
Wi-Fi). After that it runs entirely on your iPhone's GPU, offline, in about a
second or two per photo. It uses IMG.LY's open-source
[background-removal](https://github.com/imgly/background-removal-js) library
(AGPL licensed, free to use here).

## Good to know

- **Your closet lives on this phone only.** Deleting the home-screen app or
  clearing Safari's website data erases it. A backup/export feature is planned.
- To try changes on a computer, run `python -m http.server 8123` in this folder
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
├── add-item.js            Photo → background removal → name/category → save
├── background-removal.js  On-device AI background removal
├── images.js              Resize/orient photos, trim transparent edges
├── db.js                  On-device storage (IndexedDB)
├── settings.js            Appearance (System / Light / Dark)
├── ui.js                  Sheets, category chips
└── categories.js          Categories and canvas layer order
icons/                Home-screen icons
```

## Next milestones

- [ ] Outfit canvas: drag, pinch to resize, rotate, layer order, save/name outfits
- [ ] Backup & restore (export your closet to a file in Files/iCloud Drive)
- [ ] Manual edge refinement (erase/restore brush using the stored original)
- [ ] Edit an item's name and category
