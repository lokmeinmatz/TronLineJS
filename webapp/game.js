
let socket = io('http://192.168.178.24:3000')
let infoP
function init() {
  console.log('Init page')
  infoP = document.getElementById('info')
  document.getElementById('connectButton').onclick = () => {
    let nickname = document.getElementById('name').value
    if(nickname.length <= 0) {
      infoP.innerText = 'No nickname specified'
      return
    }
    infoP.innerText = 'Connectiong as ' + nickname
    connectToServer(nickname)
  }
}

let myName = ''
function connectToServer(nickname) {
  socket.emit('join', nickname)
  infoP.innerText = 'Waiting for server response...'

  socket.on('joinresponse', res => {
    if(res.valid) {
      //it worked!!!
      infoP.innerText = 'Joining successful'
      document.getElementById('login').remove()
      myName = nickname
      setupGame()
    }
    else {
      infoP.innerText = 'Username allready taken'
    }



    socket.removeAllListeners('joinresponse')
  })
}

let gameActive = false

function setup() {}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight)
}

function setupGame() {
  gameActive = true
  createCanvas(window.innerWidth, window.innerHeight)
  console.log('Starting p5 ' + height)
  fill(255)
  noStroke()
}

let gameState = {title : 'Not connected'}


socket.on('gameState', gState => {
  console.log('Received new gameState')
  if(gState.title) {
    gameState = gState
    if(gState.type == 'Play') {
      me = new ClientPlayer(myName, createVector(gState.startPos.x, gState.startPos.y), gState.startDir)
    }
  }
})


function getFieldSize() {
  return Math.min(width, height)
}

function mapRelToScreen(vec) {
  let smaller = getFieldSize()
  //
  return createVector(map(vec.x, 0, 100, 0, smaller), map(vec.y, 0, 100, 0, smaller))
}



class ClientPlayer {
  constructor(name, pos, dir) {
    this.name = name
    this.pos = pos
    this.dir = dir
    this.path = []
    this.plottedPath = createGraphics(getFieldSize(), getFieldSize())
  }

  move() {
    if(keyIsDown(65)) this.dir -= 0.02 // a
    if(keyIsDown(68)) this.dir += 0.02 // d


    //TOUCH
    if(touches.length > 0) {
      let t = touches[0]
      if(t.x > width / 2) this.dir -= 0.02
      else this.dir += 0.02
    }

    //create vector from angle
    let walkVec = createVector(cos(me.dir), sin(me.dir)).mult(0.2)
    this.addPathElement({x: this.pos.x, y: this.pos.y})
    this.pos.add(walkVec)
  } 


  addPathElement(p) {
    this.path.push(p)
    //Draw to plottedPath
    if(this.path.length < 2) return //no plotting
    this.plottedPath.stroke(255, 200, 100)
    const lastPointMapped = mapRelToScreen(this.path[this.path.length - 2])
    const newPointMapped = mapRelToScreen(p)

    this.plottedPath.line(lastPointMapped.x, lastPointMapped.y, newPointMapped.x, newPointMapped.y)
  }

  draw(showName) {


    noFill()
    stroke(255, 100, 0)
    //Draw plotted path
    image(this.plottedPath, 0, 0) //TODO x and y valable center

    noStroke()
    fill(255) //TODO individual color
    //Draw relative (0 - 100) => every palyer sees same screen
    let screenPos = mapRelToScreen(this.pos)
    ellipse(screenPos.x, screenPos.y, 10, 10)

    if(showName) {
      text(this.name, screenPos.x + 5, screenPos.y)
    }

  }

  update(data) {
    this.pos = data.pos
    this.dir = data.dir

    this.addPathElement({x: this.pos.x, y: this.pos.y})
  }
}


let players = []
let me


socket.on('gameTick', tickData => {
  if(!gameActive) return
  if(myName == 'deb'){
    debugger
  }
  for(let tickPlayer of tickData.players) {
    if(tickPlayer.name == me.name) continue

    //find player
    let localPlayer = players.find(e => e.name == tickPlayer.name)
    if(localPlayer == undefined || localPlayer == null) {
      //Create new one
      localPlayer = new ClientPlayer(tickPlayer.name, tickPlayer.pos, tickPlayer.dir)
      players.push(localPlayer)
    }

    //needs pos and dir
    localPlayer.update(tickPlayer)
  }
})

function draw() {
  //console.log('update')
  if(!gameActive) return
  background(0)

  stroke(255, 200, 100)
  strokeWeight(1)
  //console.log('Draw bg')
  noFill()
  {
    const tl = mapRelToScreen(createVector(0, 0))
    const br = mapRelToScreen(createVector(100, 100))

    rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
  }

  //Draw gameState
  noStroke()
  fill(255)
  textSize(15)
  textAlign(CENTER)
  text(gameState.title, 0.5 * width, 30)


  if(gameState.type == 'Countdown') {
    textSize(30)
    text(gameState.counter, 0.5 * width, 60)

    //display all players
    rect(0.5 * width - 30, 70, 60, 3)
    text('Players on the server', 0.5 * width, 100 )
    textSize(25)
    for(let i = 0; i < gameState.players.length; i++) {
      text(gameState.players[i], 0.5 * width, 130 + i * 30)
    }
  }
  else if(gameState.type == 'Play') {
    text('as: ' + me.name, 0.5*width + 50, 30)
    //game logic
    //Draw me
    textAlign(LEFT)
    me.move()

    me.draw(true)

    for(let p of players) {
      p.draw(true)
    }



    //send tickupdate to server
    socket.emit('playerTick', {pos: {x: me.pos.x, y: me.pos.y}, dir: me.dir, tickID: frameCount})
  }
}