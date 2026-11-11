import React from "react";
import Head from "next/head";
import { Layout } from "../components/Layout";
import { CONTACT_EMAIL, SITE_TITLE } from "@utilities/branding";

const NOT_ALLOWED = [
  {
    title: "Hate and harassment",
    copy: "Don't attack or threaten people, or target them for who they are, including their race, ethnicity, religion, gender, sexuality or disability."
  },
  {
    title: "Sexual content",
    copy: "No sexual or explicit images or text. Anything that sexualizes minors is removed, the account is closed, and we report it to the authorities."
  },
  {
    title: "Violence and dangerous behavior",
    copy: "No threats, graphic violence, or content that encourages self-harm or dangerous acts."
  },
  {
    title: "Illegal activity",
    copy: "Don't use your profile to promote or sell anything illegal."
  },
  {
    title: "Impersonation",
    copy: "Don't pretend to be another person, artist or brand, and don't use a handle that suggests you work for Beeper."
  },
  {
    title: "Spam and scams",
    copy: "No misleading links, repeated promotion, or attempts to trick people out of money or personal information."
  },
  {
    title: "Other people's private information",
    copy: "Don't post someone's address, phone number or other private details without their permission."
  },
  {
    title: "Stolen work",
    copy: "Only post photos, music and other work that you made or have the right to use."
  }
];

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({
  children
}) => (
  <h2 className="neon-text-cyan mb-6 font-microtechnic text-sm leading-relaxed sm:text-base">
    {children}
  </h2>
);

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-4 font-title text-sm leading-relaxed text-gray-400">
    {children}
  </p>
);

const CommunityGuidelines: React.FC = () => (
  <Layout>
    <Head>
      <title>{`Community guidelines | ${SITE_TITLE}`}</title>
      <meta
        name="description"
        content={`What is and isn't allowed on ${SITE_TITLE} profiles, and how to report a problem.`}
      />
    </Head>

    <div className="section-container flex flex-col items-center py-16 sm:py-24">
      <div className="w-full max-w-3xl">
        <h1 className="neon-text-magenta mb-12 text-center font-microtechnic text-lg leading-relaxed sm:text-xl">
          COMMUNITY GUIDELINES
        </h1>

        <section className="mb-14">
          <Body>
            {SITE_TITLE} is for making and sharing music. These rules apply to
            everything you put on your public profile: your handle, name, photo,
            bio and links.
          </Body>
        </section>

        <section className="mb-14">
          <SectionHeading>WHAT&apos;S NOT ALLOWED</SectionHeading>
          {NOT_ALLOWED.map(({ title, copy }) => (
            <div key={title} className="mb-6">
              <h3 className="mb-2 font-title text-sm font-bold text-gray-200">
                {title}
              </h3>
              <p className="font-title text-sm leading-relaxed text-gray-400">
                {copy}
              </p>
            </div>
          ))}
        </section>

        <section className="mb-14">
          <SectionHeading>REPORT OR BLOCK SOMEONE</SectionHeading>
          <Body>
            To report a profile, open it in the app, tap the … menu, then choose
            Report. To stop someone from seeing your profile or following you,
            choose Block from the same menu. You can also email reports to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>
            .
          </Body>
        </section>

        <section className="mb-14">
          <SectionHeading>WHAT WE DO ABOUT REPORTS</SectionHeading>
          <Body>
            We review reports within 24 hours. If something breaks these rules,
            we may remove the photo, hide the profile, or lock the account.
            Serious or repeated violations can mean losing the account for good.
          </Body>
          <Body>
            If you think we got it wrong, email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {CONTACT_EMAIL}
            </a>{" "}
            and we&apos;ll take another look.
          </Body>
        </section>
      </div>
    </div>
  </Layout>
);

export default CommunityGuidelines;
