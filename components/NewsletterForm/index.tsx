import React, { useState } from "react";

export const NewsletterForm = () => {
  const [email, setEmail] = useState("");

  const handleChange = (event) => {
    console.log(event.target.value);
    setEmail(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("Submitted!");
    setEmail("");
  };

  return (
    <div>
      <h3>Please sign up for our newsletter</h3>
      <form onSubmit={handleSubmit}>
        <input
        type="text"
        placeholder="enter email"
        value={email}
        name="text"
        onChange={handleChange}/>
          <button>Submit</button>
      </form>
    </div>
  );
};
