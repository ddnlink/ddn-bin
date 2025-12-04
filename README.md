# DDN Scripts

DDN development script tool for managing multi-node development environments in the examples directory. This tool implements all the functionality of the original shell scripts with several improvements.

## Features

Compared to the original shell scripts, this tool offers the following improvements:

1. **Key Distribution**: Automatically distributes delegate keys to different nodes
2. **P2P Port Configuration**: Properly handles HTTP ports and P2P ports
3. **Template Directory Copy**: Copies complete configuration and files from template directories
4. **Health Checks**: Verifies if nodes start successfully and attempts to terminate processes if startup fails
5. **Multi-Project Support**: Supports both fun-tests and main-tests project types
6. **Command Line Interface**: Provides a more user-friendly CLI and help information

## Installation

```bash
$ npm install @ddn/bin --save

# or
$ yarn add @ddn/bin -D
```

development:

```bash
$ cd scripts/ddn-bin
$ npm install --save @oclif/core @oclif/plugin-help oclif
$ npm run build
$ npm link
```

## Testing

Run unit tests:

```bash
$ yarn test
```

Run tests with file watching:

```bash
$ yarn run test:watch
```

Generate test coverage report:

```bash
$ yarn run test:coverage
```

## Configuration

### Project Types

All commands support the `-t` parameter to specify project type:

- `fun-tests`: Entertainment test network (default)
- `main-tests`: Mainnet test network

### Port Configuration

The tool uses two sets of ports:

- HTTP Ports: Starting from 8001, used for HTTP API communication
- P2P Ports: Starting from 9001, used for P2P communication between nodes

Each node has one HTTP port and one P2P port. For example, the first node's HTTP port is 8001 and P2P port is 9001.

## Directory Structure

```
examples/
├── fun-tests/
│   ├── config/
│   │   └── ...
│   └── app.js
├── main-tests/
│   ├── config/
│   │   └── ...
│   └── app.js
├── peer-8001/
│   ├── logs/
│   ├── db/
│   ├── public/
│   ├── ssl/
│   └── .ddnrc.js
├── peer-8002/
│   └── ...
└── ...
```

### Starting Multiple Nodes

```bash
# Start 5 nodes (default)
$ ddn-bin peers:start

# Start 3 nodes
$ ddn-bin peers:start -n 3

# Force start (even if ports are in use)
$ ddn-bin peers:start -f

# Start a specific single node
$ ddn-bin peers:start -p 8001

# Start nodes in mainnet test project
$ ddn-bin peers:start -t main-tests
```

### Stopping Nodes

```bash
# Stop all nodes
$ ddn-bin peers:stop

# Stop 3 nodes
$ ddn-bin peers:stop -n 3

# Force stop (using SIGKILL)
$ ddn-bin peers:stop -f

# Stop a specific single node
$ ddn-bin peers:stop -p 8001

# Stop nodes in mainnet test project
$ ddn-bin peers:stop -t main-tests
```

### Cleaning Node Data

```bash
# Clean all data for all nodes
$ ddn-bin peers:clean

# Clean only databases
$ ddn-bin peers:clean -c db

# Clean only logs
$ ddn-bin peers:clean -c log

# Clean specific files
$ ddn-bin peers:clean -f blockchain

# Clean specific node
$ ddn-bin peers:clean -p 8001

# Clean node data in mainnet test project
$ ddn-bin peers:clean -t main-tests
```

### Monitoring Nodes

```bash
# Monitor all nodes
$ ddn-bin peers:monitor

# Set monitoring interval (seconds)
$ ddn-bin peers:monitor -i 30

# Enable auto-restart
$ ddn-bin peers:monitor -r

# Monitor nodes in mainnet test project
$ ddn-bin peers:monitor -t main-tests
```

## Node Inspection

To verify the above information, you can check the node log files or use ddn to view node status.

```sh
# View node logs
$ tail -f ./logs/main.log
$ tail -f ./logs/debug.log
$ tail -f ./logs/dvm.log

# View node status
$ ddn p stat -H 127.0.0.1 -P 8001
$ ddn p stat -H 117.78.45.44 -P 8000 -M
```

View in browser: http://127.0.0.1:8001/api/blocks/getHeight

## Development

```bash
# Build
$ yarn run build

# Run tests
$ yarn test
```

## FAQ

1. If you encounter `Error: listen EADDRINUSE: address already in use :::8001`, it means the port is already in use and you need to change the port number.
2. If you encounter "Sandbox is not ready" error, it's most likely due to database initialization issues. Copying a blockchain.db file should resolve this.

## License

MIT 