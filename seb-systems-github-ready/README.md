# Sebastian Ortiz — Small Business Systems Builder

A small, static website ready to place in a GitHub repository and deploy through Vercel.

## Site structure

- `index.html` — Home, three core problems, services and process
- `case-example.html` — Project examples, including the Blue Collar People case study
- `about.html` — About Seb and philosophy/approach combined
- `contact.html` — Screened inquiry form
- `pricing.html` — Pricing for system connections, workflow automation and custom software
- `testimonials.html` — Client feedback and future testimonial placeholders
- `assets/styles.css` — Shared styling
- `assets/site.js` — Navigation, photo fallback, Loom and form behaviour
- `assets/site-config.js` — The three values you should edit

## Add your photograph

Save the photograph as:

```text
assets/seb-photo.jpg
```

A vertical image around 4:5 works well. Use a natural office or working photograph rather than a heavily staged corporate headshot.

## Add the Loom case-example video

Open:

```text
assets/site-config.js
```

Paste the Loom **embed URL** into `loomEmbedUrl`:

```javascript
loomEmbedUrl: "https://www.loom.com/embed/VIDEO_ID"
```

Use the `/embed/` URL, not the normal `/share/` URL.

## Connect the inquiry form

You have two options in `assets/site-config.js`:

1. Add `contactEmail`. Until a form service is connected, submitting the form opens a prepared email.
2. Add `contactFormAction` using a Formspree endpoint or a Vercel API route. This is the better production option.

## GitHub and Vercel

1. Create a new GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. In Vercel, select **Add New → Project**.
4. Import the GitHub repository.
5. Leave Framework Preset as **Other**.
6. Leave Build Command blank.
7. Leave Output Directory blank.
8. Deploy.

No database, Supabase project, build tool or framework is required.
