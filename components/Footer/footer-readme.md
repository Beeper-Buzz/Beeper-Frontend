** ReadMe DOC for using the DNA footer Component **

- import the component \*
  import {Footer} from "../components";
- define the style \*
  const styles={color:'#000'}
- props for passing all the links into the component \*
  const links=[
  {type:'legal',text:"hello world",url:'http://localhost:3000',icon:(()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},
  {type:'contact',text:"hello world",url:'http://localhost:3000',icon:(()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},
  {type:'social',text:"hello world",url:'http://localhost:3000',icon:(()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},
  {type:'legal',text:"hello world",url:'http://localhost:3000',icon:(()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},
  ]

** props for decide show types of links **

<Footer showLegal={false} links={links} styles={styles} />

** all props **

1. links: this is an ayyay of link object,
   link.type: the type of link, it can be "legal" "contact" or "social"
   link.text:the text of link,
   link.url:the url of link
   link.icon:a function return icon element

2.showLegal whether or not display legal links.default=true.

3.showContact whether or not display contact links.default=true.

4.showSocial whether or not display social links, default=true
