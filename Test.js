const TronWeb = require('tronweb')
const fullNode = 'https://api.shasta.trongrid.io';
const solidityNode = 'https://api.shasta.trongrid.io';
const eventServer = 'https://api.shasta.trongrid.io';

const privateKey = 'bbe8e7807e42c579e1784263c7e8c8c01593ac1c265e6b1a6ac4dd499ecd523f';

const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);
tronWeb.trx.getTransaction('85683d323097bf556b5350a99bb885ea66d00b0fe977aefa928adb97cfe9134e').then((res)=>{
console.log(res)
})