import mailchimp from "@mailchimp/mailchimp_marketing";
import { AddListMemberBody } from "mailchimp__mailchimp_marketing";
import fetch from 'node-fetch';

mailchimp.setConfig({
  apiKey: process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY,
  server: process.env.NEXT_PUBLIC_MAILCHIMP_USERNAME
});

export default async (req: any, res: any) => {
  const { email, firstName, lastName, phone, newContact } = req.body;
  const ghlLocation = process.env.NEXT_PUBLIC_GOHIGHLEVEL_LOCATION_ID || '';
  const ghlForm = process.env.NEXT_PUBLIC_GOHIGHLEVEL_FORM_ID || '';
  const mailerService = process.env.NEXT_PUBLIC_MAILER;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (mailerService === 'mailchimp') {
    const mailchimpId = `${process.env.NEXT_PUBLIC_MAILCHIMP_AUDIENCE_ID}`;

    if (newContact) {
      try {
        await mailchimp.lists.addListMember(mailchimpId, {
          email_address: email,
          status: "subscribed"
        } as AddListMemberBody);

        return res.status(201).json({ error: "" });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || error.toString() });
      }
    }

    try {
      await mailchimp.lists.updateListMember(mailchimpId, email, {
        email_address: email,
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          PHONE: phone
        }
      } as AddListMemberBody);

      return res.status(201).json({ error: "" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || error.toString() });
    }
  }

  if (mailerService === 'gohighlevel') {
    try {
      const response = await fetch('https://services.leadconnectorhq.com/forms/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: JSON.stringify({
          "first_name": firstName,
          "last_name": lastName,
          "phone": phone,
          "email": email,
          "formId": ghlForm,
          "location_id": ghlLocation,
          "eventData":{"source": "direct"}
        })
      });

      const responseData = await response.json();
      return res.status(201).json(responseData);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || error.toString() });
    }
  }
};
