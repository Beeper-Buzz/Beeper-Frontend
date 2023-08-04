import React from "react";
import {HamburgerMenu} from "../components";

const Test = () => {
    return (<div id={'outter-container'}>
            <HamburgerMenu outterContainerId={'outter-container'} pageWrapId={'page-wrap'} animationType={'fallDown'}
                           right>
                <a id="home" className="menu-item" href="/">Home</a>
                <a id="about" className="menu-item" href="/about">About</a>
                <a id="contact" className="menu-item" href="/contact">Contact</a>
                <a className="menu-item" href="">Settings</a>
            </HamburgerMenu>
            <main id={'page-wrap'} className={'page-wrap'}>

            </main>
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
