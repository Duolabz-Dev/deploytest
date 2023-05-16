const express = require('express');
const ethers = require('ethers');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mysql = require("mysql");
const TronWeb = require('tronweb');
//const contractABI =require('./contractABI.json')
const privateKey = 'bbe8e7807e42c579e1784263c7e8c8c01593ac1c265e6b1a6ac4dd499ecd523f';
const Web3 = require('web3')
const fullNode = 'https://api.shasta.trongrid.io';
const solidityNode = 'https://api.shasta.trongrid.io';
const eventServer = 'https://api.shasta.trongrid.io';
const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);
let web3 = new Web3(Web3.defaultProvider)



const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000, 
  pingInterval: 10000, 
});

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  // host:'127.0.0.1',
  // user:'root',
  // password:'',
  // database:'signup'
})
db.connect(function(err) {
  if (err) console.log(err);
  console.log("Connected!");
});
app.post('/signup', (req, res) => {
    const sql = "INSERT INTO login (`id`,`name`, `email`,`phone`,`age`, `password`) VALUES(?)";
    
    const values = [
        req.body.id,
        req.body.name,
        req.body.email,
        req.body.phone,
        req.body.age,
        req.body.password
    ]
    db.query(sql, [values], (err,data) => {
        if(err){
            return res.json("Error");
        }
        return res.json(data);
    })
})

app.post('/game-history', (req, res) => {
  const sql = "INSERT INTO gamehistory (`id`, `user`, `opponent`, `bet`, `status`) VALUES (?)";
  const values = [
    req.body.id,
    req.body.name,
    req.body.opponent,
    req.body.bet,
    req.body.status
  ];

  db.query(sql, [values], (err, data) => {
    if (err) {
      console.log(err); // Log the error to the console
      return res.status(500).json({ error: "Error", details: err }); // Send error details to the client
    }
    return res.status(200).json(data);
  });
});
app.get('/rewards/:id', async (req, res) => {
  const { id } = req.params;
  console.log(id)
    db.query('SELECT * FROM pendingRewards WHERE playerId = ?', [id], function(error, results) {
        if (error) {
            console.error(error.message);
            res.status(500).json("Server error");
        } else {
            res.json(results);
            console.log(results)
        }
    });
});

app.get('/sign', async (req, res) => {
  const address = req.query.address;
  const amount = req.query.amount;
  let contract = await tronWeb
      .contract()
     .at("TV7e8TCAdvqZDjwG37W5YsEAeW7GPb6eVN");
  const nonce= (await  contract.nonces(address).call()).toNumber();
  var encodedParams = ethers.utils.solidityPack(['address','uint256','uint256'],[address,amount,nonce])
  var hash = ethers.utils.solidityKeccak256(['bytes'],[encodedParams])
  var sig = web3.eth.accounts.sign(hash,'0x'+privateKey)

   const result = {
    nonce:nonce,
    msghash:sig.messageHash,
    signature:sig.signature
   }
   res.json(result);
});

app.post('/delete', async (req, res) => {
  const id=req.body.id;
  console.log(id)
  deletePendingReward(id)
});


app.post('/login', (req, res) => {
  const sql = "SELECT * FROM login WHERE (`email` = ? OR `phone` = ?) AND `password` = ? ";

  db.query(sql, [req.body.email, req.body.email, req.body.password], (err, data) => {
      if (err) {
          return res.status(500).json({ error: "Error" });
      }
      if (data.length > 0) {
          const userData = {
              id: data[0].id, 
              name: data[0].name,
          };
          return res.status(200).json(userData);
      } else {
          return res.status(401).json({ error: "Failure" });
      }
  })
});


const games = new Map();

const createGame = (playerId, betAmount,username,uid,useraddress,sign) => {
  return {
    players: [playerId],
    userid:[uid],
    turn: playerId,
    squares: Array(9).fill(null),
    name: [username],
    betAmount: betAmount,
    useraddress:[useraddress],
    sign:[sign]
  };
};


io.on('connection', (socket) => {
  console.log('User connected');
  setInterval(() => {
    socket.emit('heartbeat');
  }, 10000);

  socket.on('heartbeatResponse', (res) => {
  });
  socket.on('aigameend',async ({player1})=>{
    saveGameHistory(player1);
      const receiver = player1.address; 
      let contract = await tronWeb
      .contract()
     .at("TV7e8TCAdvqZDjwG37W5YsEAeW7GPb6eVN");
      const nonce= (await  contract.nonces(receiver).call()).toNumber();
      if(player1.status==='Won'){
        winnings = ((player1.bet))* 90 / 100;
      const amount = tronWeb.toSun(winnings); 
      var address1 = '0x' + await (tronWeb.address.toHex(receiver).split('41'))[1]
         //get checksum address
         address1 = web3.utils.toChecksumAddress(address1)
         var encodedParams = ethers.utils.solidityPack(['address','uint256','uint256'],[address1,amount,nonce])
         var hash = ethers.utils.solidityKeccak256(['bytes'],[encodedParams])
         var sig = web3.eth.accounts.sign(hash,'0x'+privateKey)

          const currentrewardid=savePendingReward({ playerId: player1.id, address1,amount});
         io.to(player1.sid).emit('reward',address1,sig.messageHash,sig.signature,nonce,amount,player1.sid,'Draw',currentrewardid)
         
   }
     else if(player1.status==='Draw'){
       winnings = ((player1.bet))*40/100;
       const amount = tronWeb.toSun(winnings);
       console.log(amount)
    
       var address1 = '0x' + await (tronWeb.address.toHex(receiver).split('41'))[1]
       address1 = web3.utils.toChecksumAddress(address1)
       console.log(address1) 
       var encodedParams = ethers.utils.solidityPack(['address','uint256','uint256'],[address1,amount,nonce])
       var hash = ethers.utils.solidityKeccak256(['bytes'],[encodedParams])
       var sig = web3.eth.accounts.sign(hash,'0x'+privateKey)
       const currentrewardid=savePendingReward({ playerId: player1.id, address1,amount});
       io.to(player1.sid).emit('reward',address1,sig.messageHash,sig.signature,nonce,amount,player1.sid,'Draw',currentrewardid)
   }
  });
  
  socket.on('joinGame', (betAmount,playername,uid,useraddress) => {
    let game = Array.from(games.values()).find(
      (game) => game.players.length === 1 && game.betAmount === betAmount

    );

    if (!game) {
      
      game = createGame(socket.id, betAmount,playername,uid,useraddress,'x');
      games.set(game.players[0], game);
    } else {
      game.players.push(socket.id);
      game.name.push(playername);
      game.userid.push(uid);
      game.useraddress.push(useraddress);
      game.sign.push('o');
    }

    socket.join(game.players[0]);
    io.to(game.players[0]).emit('gameJoined', game);
    io.to(game.players[0]).emit('gameUpdated', game);

    socket.on('move', ({ index, squares, turn }) => {
      game.squares = squares;
      game.turn = turn;
      io.to(game.players[0]).emit('move', { index, squares });
      io.to(game.players[0]).emit('gameUpdated', game);
    }).on('error', (error) => {
      console.error(`Error during 'move' event: ${error}`);
    });
    socket.on('gameEnded', async ({ player1, player2 }) => {
      saveGameHistory(player1);
      saveGameHistory(player2);
      let winnings;
      if(player1.status==='Won'){
         winnings = ((game.betAmount)*2 )* 90 / 100;
         const receiver = player1.address; 
         let contract = await tronWeb
         .contract()
        .at("TV7e8TCAdvqZDjwG37W5YsEAeW7GPb6eVN");
         const nonce= (await  contract.nonces(receiver).call()).toNumber();
         const amount = tronWeb.toSun(winnings); 
         
         var address = '0x' + await (tronWeb.address.toHex(receiver).split('41'))[1]
        //get checksum address
         address = web3.utils.toChecksumAddress(address)
        //get hash of parameters off-chain optional hai but good practice
         var encodedParams = ethers.utils.solidityPack(['address','uint256','uint256'],[address,amount,nonce])
         var hash= ethers.utils.solidityKeccak256(['bytes'],[encodedParams])
         var sig = web3.eth.accounts.sign(hash,'0x'+privateKey)
         const currentrewardid=savePendingReward({ playerId: player1.id, address, amount});
         io.to(player1.sid).emit('reward',address,sig.messageHash,sig.signature,nonce,amount,player1.sid,'Won',currentrewardid)
         io.to(player2.sid).emit('reward',null,null,null,null,null,player2.sid,player2.status,null);
         games.delete(game);
      }
     
      
     else if(player1.status==='Draw'){
      let contract = await tronWeb
      .contract()
     .at("TV7e8TCAdvqZDjwG37W5YsEAeW7GPb6eVN");
        winnings = ((game.betAmount)*2 )*40/100;
        const receiver1 = player1.address; 
        const nonce1= (await  contract.nonces(receiver1).call()).toNumber();
        const amount = tronWeb.toSun(winnings);
        var address1 = '0x' + await (tronWeb.address.toHex(receiver1).split('41'))[1]
    //get checksum address
       address1 = web3.utils.toChecksumAddress(address1)

    //get hash of parameters off-chain optional hai but good practice
       var encodedParams1 = ethers.utils.solidityPack(['address','uint256','uint256'],[address1,amount,nonce1])
       var hash1= ethers.utils.solidityKeccak256(['bytes'],[encodedParams1])
       var sig1 = web3.eth.accounts.sign(hash1,'0x'+privateKey)
        const receiver2 = player2.address; 
        const nonce2= (await  contract.nonces(receiver2).call()).toNumber();
        var address2 = '0x' + await (tronWeb.address.toHex(receiver2).split('41'))[1]
    //get checksum address
       address1 = web3.utils.toChecksumAddress(address2)
    //get hash of parameters off-chain optional hai but good practice
       var encodedParams2 = ethers.utils.solidityPack(['address','uint256','uint256'],[address2,amount,nonce2])
       var hash2= ethers.utils.solidityKeccak256(['bytes'],[encodedParams2])
       var sig2 = web3.eth.accounts.sign(hash2,'0x'+privateKey)
        const currentrewardid1=savePendingReward({ playerId: player1.id, address1, amount});
        const currentrewardid2=savePendingReward({ playerId: player2.id, address2, amount});
        io.to(player1.sid).emit('reward',address1,sig1.messageHash,sig1.signature,nonce1,amount,player1.sid,'Draw',currentrewardid1)
        io.to(player2.sid).emit('reward',address2,sid2.messageHash,sig2.signature,nonce2,amount,player2.sid,'Draw',currentrewardid2)
        games.delete(game);
      }
       
    });
    socket.on('error', (error) => {
      console.error(`Socket error (${socket.id}):`, error);
    });

    socket.on('connect_failed', function() {
      document.write("Sorry, there seems to be an issue with the connection!");
   })
  
    socket.on('disconnect', (reason) => {
      console.log('User disconnected');
      console.log(`User disconnected (${socket.id}):`, reason);
      if (game.players.length === 2) {
        const otherPlayerId = game.players.find((player) => player !== socket.id);
        io.to(otherPlayerId).emit('playerLeft');
      }
    });
  }).on('error', (error) => {
    console.error(`Error during 'joinGame' event: ${error}`);
  });
});
function savePendingReward({ playerId, address, amount }) {
  // const sql = `CREATE TABLE IF NOT EXISTS pendingRewards (rewardId INT AUTO_INCREMENT, playerId VARCHAR(255), address VARCHAR(255), amount FLOAT, PRIMARY KEY (rewardId))`;
  // db.query(sql, (err, result) => {
  //   if (err) throw err;
  //   console.log("Table created");

    const insertSql = `INSERT INTO pendingRewards SET ?`;
    const values = { playerId, address, amount };
    db.query(insertSql, values, (err, result) => {
      if (err) {
        console.log({ error: err });
        return;
      }
      return result.insertId;
    });
 // });
}

function deletePendingReward(rewardId) {
  const sql = `DELETE FROM pendingRewards WHERE rewardId = ?`;
  db.query(sql, [rewardId], (err, result) => {
    if (err) throw err;
    console.log("Reward deleted");
  });
}

function saveGameHistory({  id,name,opponent,bet,status }) {
    const sql = "INSERT INTO gamehistory (`id`, `user`, `opponent`, `bet`, `status`) VALUES (?)";
    const values = [
      id,
      name,
      opponent,
      bet,
      status
    ];
  
    db.query(sql, [values], (err, data) => {
      if (err) {
        console.log ({ error: err });
        return;
      }
      console.log('Game history saved successfully.');
    });
  }


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));