import React from 'react'
import BurgerMenu from './BurgerMenu'

const HamburgerMenu=props=>{
    const {animationType,children,...others}=props
        const Menu=BurgerMenu[animationType]
        return (
            <Menu
                {...others}
            >
                {
                    children
                }
                <style jsx global>
                    {`
                      .bm-burger-button {
                        position: fixed;
                        width: 36px;
                        height: 30px;
                        left: 36px;
                        top: 36px;
                      }

                      .bm-burger-button button:focus {
                        outline: 2px solid #c94e50;
                        outline-offset: 8px;
                      }

                      .bm-burger-button button:focus + span span.bm-burger-bars {
                            background-color: #c94e50;
                          }

                      .right .bm-burger-button {
                        left: initial;
                        right: 36px;
                      }

                      .bm-burger-bars {
                        background: #373a47;
                      }

                      .bm-burger-bars-hover {
                        background: #a90000;
                      }

                      .bm-cross-button {
                        height: 24px;
                        width: 24px;
                      }

                      .bm-cross {
                        background: #bdc3c7;
                      }

                      .bm-menu-wrap {
                        position: fixed;
                        height: 100%;
                      }

                      .bm-menu {
                        background: #373a47;
                        padding: 2.5em 1.5em 0;
                        fontSize: 1.15em;
                        height:100%;
                      }

                      .bm-morph-shape {
                        fill: #373a47;
                      }

                      .bm-item-list {
                        color: #b8b7ad;
                        padding: 0.8em;
                        height: 100%;
                      }

                      .bm-item {
                        display: block;
                        padding:0.8em;
                      }

                      .bm-overlay {
                        background: rgba(0, 0, 0, 0.3);
                      }
                    `}
                </style>
            </Menu>
        )


}
export default HamburgerMenu