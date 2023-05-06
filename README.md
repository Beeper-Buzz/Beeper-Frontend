This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### Running Locally

- `cp .env.example .env.development`
- Replace `.env.development` with variables from Aaron
- `yarn dev`
- Open [http://localhost:3000](http://localhost:3000) in your browser.

## NextJS

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Styles

Always use `@emotion/styled` wherever possible. If regular CSS is required, use one of the following style files.
We manage our global styles in several files:

- `./styles/global-styles.tsx` (global stylesheet)
- `./styles/fonts.css` (global @font-face rules)
- `./styles/all.css` (global styles injected in at app root)
- `./styles/theme.tsx` (global theme variables)
- `./emotion.d.ts` (theme typings)

## Gotchas

- The app has a "Maintenance Mode" (branded fullscreen takeover), simply set `IS_MAINT_MODE=true`, and the `<Header/>` will disappear and `<Home/>` gets taken over by `<ComingSoon/>`. It's fun, try it!
- All the data for the app comes in from our staging server on Heroku, but you can also run the dna-admin CMS+API locally (hint: login only works with a localhost API)
- To run against the local API, set the `SPREE_API_URL` environment
  variable to the local API host/port
- Complains about missing `.next/build-manifest.json` are usually indications
  of a `next` build error. Try running `$(npm bin)/next build` to see the
  exact error.

## Deployment

- Create pipeline in Heroku
- add Github repo
- Create app
- heroku buildpacks:add <https://github.com/heroku/heroku-buildpack-nodejs> -a app-name
- heroku buildpacks:add heroku/nodejs -a app-name

Unset all Heroku env vars:
`heroku config:unset $(heroku config --shell | sed 's/=.*//' | xargs) -a app-name`

POL Admin Interface & API
<http://dna-admin-dev.instinct.is/>
<http://dna-admin-staging.instinct.is/>

POL Frontend Interface
<https://dna-frontend-dev.instinct.is/>
<https://dna-frontend-staging.instinct.is/>

## Keeping Your Code Updated

When there are lots of active changes occuring on this repo, make sure to regularly:

1. Commit (or stash) your local changes on your branch
1. `git fetch origin`
1. `git checkout main`
1. `git pull origin main`
1. `git checkout <your_branch>`
1. `git merge main`
1. Fix merge conflicts (if any)
1. `git add .`
1. `git commit -m 'merge in latest main'`

Done!
…now you will be up-to-date with latest code. Do this before you submit your PR, and you can be sure it will be a clean merge.

## Testing API Endpoints

<https://localhost:8080/apidocs/swagger_ui#/>

## Updating a fork

- `git remote add upstream git@github.com:1instinct/dna-frontend.git`
- `git fetch upstream`
- `git checkout main`
- `git pull upstream main`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/import?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

# TODO

- Move data fetching into on `getInitialProps`
- Setup Redux

- ~~Flow / Type Checking~~ (TypeScript)
- ~~React~~
- ~~SSR~~ (NextJS)
- ~~State Mgmt~~ (hooks/useContext... no Redux, yet)
- ~~Request Mgmt~~ (React Query)
- ~~Search~~ (Fuse.js)
- Pusher / API Integration
- ~~Styled Components~~ (@emotion/styled)
- Moving Letters
- UI Sounds (proprietary: "npm install beeper")
- Maps
- File upload (ReactDropzone)
- ~~Form validation (Formik)~~
- Animations / Transitions (ReactSpring, GSAP)
- Gestures
- UI Alerts
- Uptime Monitoring
- Twilio
- Unit Testing
- Chat widget
- Chatbot (Rasa)
- Browser Feature Detection
- Speed/Performance Benchmarking (GTMetrix.com API?)
- Header tags customization (NextJS: `next/header`)
- ~~Secrets management / Environment variables~~ (`dot-env`)
