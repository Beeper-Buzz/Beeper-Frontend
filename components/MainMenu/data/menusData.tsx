import AccessAlarmIcon from '@material-ui/icons/AccessAlarm';
import AssignmentIcon from '@material-ui/icons/Assignment';
import LaptopMacIcon from '@material-ui/icons/LaptopMac';
import {menuDataItem} from "../types";
export const menusData:menuDataItem[]=[
    {
        name:'HOT DIGS',
        key:'hotdigs',
        icon:()=><AccessAlarmIcon style={{color:'#fff'}} />,
        pcIcon: ()=><AccessAlarmIcon style={{color:'#fff',marginRight:'5px'}} />,
    },
    {
        name:'NEW DIGS',
        key:'newdigs',
        icon:()=><AssignmentIcon style={{color:'#fff'}} />
    },{
    name:'CLOTHING',
        key:'clothing',
        children:[
            {
                name:'TOPS',
                key:'tops',
                icon:()=><LaptopMacIcon style={{color:'#fff'}} />,
                pcIcon: ()=><AccessAlarmIcon style={{color:'#000',marginRight:'5px'}} />,
            },
            {
                name:'BOTTOMS',
                key:'bottoms',
            },{
             name:'DRESSES',
                key:'dresses'
            },{
        name:'JACKETS',
                key:'jackets'
            },{
        name:'INTIMATES',
                key:'intimates'
            }
        ]
    },
    {
        name:'FRILLS',
        key:'frills',
        children:[
            {
                name: 'BAGS',
                key: 'bags'
            },
            {
                name:'SHADES',
                key:'shades'
            },{
            name:'HATS',
                key:'hats'
            },{
            name:'BELTS',
                key:'belts'
            },{
            name:'JEWELRY',
                key:'jewelry'
            }

        ]
    },
    {
        name:'PLUS',
        key:'plus'
    },
    {
        name: 'BY POL',
        key:'bypol',
        children: [
            {
                name:'S/S 21',
                key:'ss21',
            },{
            name:'DENIM',
                key:'denim'
            },
            {
                name:'HOME',
                key:'home'
            }
        ]
    },
    {
        name:'SALE',
        key:'sale',
    },
    {
        name:'POL TV',
        key:'poltv',
    },
    {
        name:'EVENTS',
        key:'events'
    }
]