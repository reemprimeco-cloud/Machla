# Product photography

Two directories, split by **who owns the image** — because only one of
the two may be committed to what is a public repository:

| | What lives there | Committed? |
|---|---|---|
| `./` (here) | Images **you** supply — licensed stock, your own photographs | ✗ no |
| `./generated/` | AI-generated originals this project owns outright | ✓ yes |

They share one filename namespace at upload time, and a file placed here
in the root **overrides** a generated one of the same name — so replacing
generated artwork with a real photograph is just dropping the file in,
with nothing to delete. See `generated/README.md` for how those were made
and why several categories were deliberately left on their emoji.

Drop licensed image files here, named after the **product type**:

```text
milk_fresh.webp      → every milk_fresh product, whatever brand or size
tomato.webp
basmati_rice.jpg
```

168 type files cover all 295 products, and adding a new brand later needs
no new photograph. To override a single product instead, name the file
after its natural key with `|` replaced by `~`
(`milk_fresh~almarai~1 l.webp`).

Then:

```bash
node catalog-import/scripts/upload-images.mjs --dry-run   # what would happen
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node catalog-import/scripts/upload-images.mjs
```

Accepted: `.webp`, `.jpg`, `.png`, max 2 MB each. They render at about
200px, so web-sized derivatives — not originals.

## Only images you have the right to use

- stock you have licensed (Shutterstock, Adobe Stock, …), within what that
  licence permits;
- photographs you took yourself;
- images whose rights holder has given you written permission.

**Not** from a Google Images search, and **not** taken from a retailer's
website — including Sharq Coop and Deliveroo Kuwait, which this project
treats as reference-only and whose product photography belongs to them or
their suppliers (`docs/architecture/11-product-catalog-architecture.md` §2).

Two things to check on a stock licence before bulk-uploading: the cheaper
tiers usually cap total impressions, and they generally forbid
redistributing an image as a standalone downloadable file. The bucket
these go to is public-read, so keep originals out of it.

Files in this directory are **not** committed — see `.gitignore` here.
The repository holds the pipeline; the licensed assets live in your
Supabase project.
