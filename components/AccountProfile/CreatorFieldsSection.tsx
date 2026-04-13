import React from "react";
import { Field } from "formik";
import { FormikInput } from "../FormikWrappers";

export const CreatorFieldsSection = () => (
  <div className="glass-panel p-6">
    <h2 className="font-micro5 text-xs tracking-widest text-neon-magenta mb-2">
      CREATOR PROFILE
    </h2>
    <p className="text-xs text-white/40 mb-4">
      These fields appear on your public profile. Handles should be bare (no @
      or URL).
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field
        name="avatar_url"
        component={FormikInput}
        label="Avatar URL (https://)"
      />
      <Field
        name="banner_url"
        component={FormikInput}
        label="Banner URL (https://)"
      />
    </div>
    <div className="mt-4">
      <Field
        name="website"
        component={FormikInput}
        label="Website (https://)"
      />
    </div>

    <h3 className="font-micro5 text-xs tracking-widest text-white/50 mt-6 mb-3">
      SOCIAL HANDLES
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field name="instagram" component={FormikInput} label="Instagram" />
      <Field name="tiktok" component={FormikInput} label="TikTok" />
      <Field name="youtube" component={FormikInput} label="YouTube" />
      <Field name="soundcloud" component={FormikInput} label="SoundCloud" />
      <Field name="bandcamp" component={FormikInput} label="Bandcamp" />
    </div>
  </div>
);
