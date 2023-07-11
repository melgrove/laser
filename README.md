# Laser • [playlaser.xyz](https://playlaser.xyz)

![laser](https://github.com/melgrove/laser/assets/38347766/84adbd7b-76a1-4279-aa60-1630fea28996)

Laser is a turn based game which is played on a chess board, and hosted online at [playlaser.xyz](https://playlaser.xyz). Some of the pieces move the same way as their chess counterparts, while some are completely different. The game is named after the *laser* piece, which can shoot diagonally through every piece on the board except for the *wall*, which blocks it. The goal when creating Laser was to make a balanced game that has unexpected emergent strategy. 
## Rules
The rules are available on the website.
## Implementation
The goal of the website is simply to allow games of laser to be played online, and thus is very minimal. All of the game logic and move validation happens in the client so the server can remain as simple as possible. The client (`svelte/`) uses a forked (modified) version the lichess UI library [chessground](https://github.com/lichess-org/chessground), and is thus released with the GPL-3.0 license. The server (`server/`) is a very minimal node.js websocket server which serves the lobby and game moves. The server also keeps track of the clocks for each game so there is a shared ground truth for clock timeouts. It is released with the MIT license.
## Credits
Laser was created by Oliver Melgrove and Tate Welty, and influenced by friends who have played against us.
The website was created by Oliver Melgrove.
