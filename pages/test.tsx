import React from "react";
import Head from 'next/head'
import {MainMenu,Footer} from "../components";

const Test = () => {
    return (<div id={'outter-container'}>
            <Head>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"></link>
            </Head>
            <MainMenu outterContainerId={'outter-container'} pageWrapId={'page-wrap'} animationType={'slide'}
                           right>
                <a id="home" className="menu-item" href="/">Home</a>
                <a id="about" className="menu-item" href="/about">About</a>
                <a id="contact" className="menu-item" href="/contact">Contact</a>
                <a className="menu-item" href="">Settings</a>
            </MainMenu>
            <main id={'page-wrap'} className={'page-wrap'}>
                <div style={{flex:1}}></div>
            <Footer showContact={true} showLegal={true} showSocial={true} styles={{color:'#000',backgroundColor:'#183558',padding:'100px 0'}} links={[{type:'legal',text:"hello world",url:'http://localhost:3000',icon:
                    (()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},{type:'contact',text:"hello world",url:'http://localhost:3000',icon:
                    (()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},{type:'social',text:"hello world",url:'http://localhost:3000',icon:
                    (()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},{type:'social',text:"hello world",url:'http://localhost:3000',icon:
                    (()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))},{type:'social',text:"hello world",url:'http://localhost:3000',icon:
                    (()=>(<i className="fa fa-facebook-official icon" aria-hidden="true"></i>))}]} />
            </main>
            <style jsx>
                {`
              .icon{
              margin-right: 10px;
              }
            `}
            </style>
            <style jsx global>
                {`
                  body {
                    padding: 0;
                    margin: 0;
                  }

                  .page-wrap {
                    padding: 4em 6em;
                    height: 100%;
                    background: #b4bad2;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                  }

                  .menu-item {
                    outline: none;
                  }
                `}
            </style>
        </div>

    );
};
export default Test;
