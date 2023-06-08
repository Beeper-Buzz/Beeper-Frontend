// Reference:
// https://leerob.io/blog/mailchimp-next-js

import mailchimp from "@mailchimp/mailchimp_marketing";
import { AddListMemberBody } from "mailchimp__mailchimp_marketing";

mailchimp.setConfig({
  apiKey: process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY,
  server: process.env.NEXT_PUBLIC_MAILCHIMP_USERNAME
});

export default async (req: any, res: any) => {
  console.log("REQ: ", req.body);
  const { email, firstName, lastName, phone, newContact } = req.body;
  const mailchimpId = `${process.env.NEXT_PUBLIC_MAILCHIMP_AUDIENCE_ID}`;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (newContact) {
    console.log("New Contact: ", newContact);
    try {
      await mailchimp.lists.addListMember(mailchimpId, {
        email_address: email,
        status: "subscribed"
      } as AddListMemberBody);

      return res.status(201).json({ error: "" });
    } catch (error: any) {
      console.log(error.message);
      return res.status(500).json({ error: error.message || error.toString() });
    }
  }

  console.log("Existing Contact: ", newContact);
  try {
    await mailchimp.lists.updateListMember(mailchimpId, email, {
      email_address: email,
      merge_fields: {
        FNAME: firstName,
        LNAME: lastName,
        PHONE: phone
        // ADDRESS: {
        //   addr1: data.streetaddress,
        //   city: 'New York',
        //   state: 'NY',
        //   zip: data.zip,
        //   country: 'US',
        // }
        // MMERGE2: ...,
      }
    } as AddListMemberBody);

    return res.status(201).json({ error: "" });
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).json({ error: error.message || error.toString() });
  }
};
