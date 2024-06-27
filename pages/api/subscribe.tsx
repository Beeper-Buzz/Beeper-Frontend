import mailchimp from "@mailchimp/mailchimp_marketing";
import { NextApiRequest, NextApiResponse } from 'next';
import fetch, { FormData } from "node-fetch";

const mailchimpAudienceId = process.env.NEXT_PUBLIC_MAILCHIMP_AUDIENCE_ID || process.env.MAILCHIMP_AUDIENCE_ID || "";
const mailchimpApiKey = process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY || process.env.MAILCHIMP_API_KEY || "";
const mailchimpUser = process.env.NEXT_PUBLIC_MAILCHIMP_USER || process.env.MAILCHIMP_USER || "";

mailchimp.setConfig({
  apiKey: mailchimpApiKey,
  server: mailchimpUser
});

const ghlLocation = process.env.NEXT_PUBLIC_GOHIGHLEVEL_LOCATION_ID || "";
const ghlForm = process.env.NEXT_PUBLIC_GOHIGHLEVEL_FORM_ID || "";

const mailerService = process.env.NEXT_PUBLIC_MAILER;

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { email, firstName, lastName, phone, newContact } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (mailerService !== 'mailchimp' && mailerService !== 'gohighlevel') {
    return res.status(400).json({ error: 'Invalid mailer service' });
  }

  if (mailerService === "mailchimp") {
    if (!mailchimpApiKey || !mailchimpAudienceId) {
      return res.status(500).json({ error: 'Missing MailChimp Details' });
    }
    const mailchimpId = `${mailchimpAudienceId}`;

    if (newContact) {
      try {
        await mailchimp.lists.addListMember(mailchimpId, {
          email_address: email,
          status: "subscribed"
        } as any);

        return res.status(201).json({ error: "" });
      } catch (error: any) {
        return res
          .status(500)
          .json({ error: error.message || error.toString() });
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
      } as any);

      return res.status(201).json({ error: "" });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || error.toString() });
    }
  }

  if (mailerService === "gohighlevel") {
    if (!ghlLocation || !ghlForm) {
      return res.status(500).json({ error: 'Missing GoHighLevel Details' });
    }
    let formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('formId', ghlForm);
    formData.append('location_id', ghlLocation);
    formData.append('eventData[source]', "direct");
    
    console.log("Sending data to GoHighLevel: ", formData);
    // {
    //   "first_name": "TEST12345",
    //   "last_name": "TEST12345",
    //   "phone": "+13124452598",
    //   "address": "TEST12345",
    //   "city": "TEST12345",
    //   "state": "TEST12345",
    //   "email": "TEST12345@m3thod.agency",
    //   "formId": "{{crm-form-id}}",
    //   "location_id": "{{crm-location-id}}",
    //   "eventData": {
    //     "source": "direct"
    //   }
    // }

    try {
      const response = await fetch(
        "https://services.leadconnectorhq.com/forms/submit",
        {
          method: "POST",
          body: formData
        }
      );
      const responseData = await response.json();
      console.log("response: ", responseData);
      return res.status(201).json(responseData);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || error.toString() });
    }
  }

  return res.status(500).json({ error: "Invalid mailer service" });
};
