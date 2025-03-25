document.addEventListener('DOMContentLoaded', () => {
    // Connect to the MCP server
    const socket = io();
    
    // Initialize terminal
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
        // Initialize terminal with custom options
        const terminal = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#f0f0f0',
                cursor: '#f0f0f0',
                selection: 'rgba(255, 255, 255, 0.3)',
                black: '#000000',
                red: '#e06c75',
                green: '#98c379',
                yellow: '#e5c07b',
                blue: '#61afef',
                magenta: '#c678dd',
                cyan: '#56b6c2',
                white: '#d0d0d0',
                brightBlack: '#808080',
                brightRed: '#e06c75',
                brightGreen: '#98c379',
                brightYellow: '#e5c07b',
                brightBlue: '#61afef',
                brightMagenta: '#c678dd',
                brightCyan: '#56b6c2',
                brightWhite: '#ffffff'
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.2,
            scrollback: 1000,
            rows: 24
        });
        
        // Add fit addon to make terminal resize properly
        const fitAddon = new FitAddon.FitAddon();
        terminal.loadAddon(fitAddon);
        
        // Add web links addon to make URLs clickable
        terminal.loadAddon(new WebLinksAddon.WebLinksAddon());
        
        // Open terminal in the container
        terminal.open(terminalElement);
        fitAddon.fit();
        
        // Initial terminal prompt
        terminal.writeln('\x1b[1;34mMCP Terminal v1.0.0\x1b[0m');
        terminal.writeln('Type \x1b[1;32mhelp\x1b[0m for available commands');
        terminal.write('\x1b[1;36m> \x1b[0m');
        
        // Handle terminal input
        let currentLine = '';
        let commandHistory = [];
        let historyIndex = -1;
        
        terminal.onKey(({ key, domEvent }) => {
            const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
            
            if (domEvent.keyCode === 13) { // Enter key
                terminal.write('\r\n');
                if (currentLine.trim()) {
                    // Add to history if not empty
                    commandHistory.push(currentLine);
                    historyIndex = commandHistory.length;
                    
                    // Process command
                    processCommand(currentLine);
                } else {
                    // Just show prompt for empty line
                    terminal.write('\x1b[1;36m> \x1b[0m');
                }
                currentLine = '';
            } else if (domEvent.keyCode === 8) { // Backspace
                if (currentLine.length > 0) {
                    currentLine = currentLine.slice(0, -1);
                    terminal.write('\b \b');
                }
            } else if (domEvent.keyCode === 38) { // Up arrow - previous command
                if (historyIndex > 0) {
                    historyIndex--;
                    // Clear current line
                    terminal.write('\r\x1b[K\x1b[1;36m> \x1b[0m' + commandHistory[historyIndex]);
                    currentLine = commandHistory[historyIndex];
                }
            } else if (domEvent.keyCode === 40) { // Down arrow - next command
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    // Clear current line
                    terminal.write('\r\x1b[K\x1b[1;36m> \x1b[0m' + commandHistory[historyIndex]);
                    currentLine = commandHistory[historyIndex];
                } else if (historyIndex === commandHistory.length - 1) {
                    historyIndex = commandHistory.length;
                    // Clear to empty line
                    terminal.write('\r\x1b[K\x1b[1;36m> \x1b[0m');
                    currentLine = '';
                }
            } else if (printable) {
                currentLine += key;
                terminal.write(key);
            }
        });
        
        // Handle terminal resize
        window.addEventListener('resize', () => {
            fitAddon.fit();
        });
        
        // Add event listeners for terminal buttons
        document.getElementById('clear-terminal').addEventListener('click', () => {
            terminal.clear();
            terminal.writeln('\x1b[1;34mMCP Terminal v1.0.0\x1b[0m');
            terminal.writeln('Type \x1b[1;32mhelp\x1b[0m for available commands');
            terminal.write('\x1b[1;36m> \x1b[0m');
            currentLine = '';
        });
        
        document.getElementById('run-command').addEventListener('click', () => {
            if (currentLine.trim()) {
                terminal.write('\r\n');
                processCommand(currentLine);
                currentLine = '';
            }
        });
        
        // Toggle fullscreen
        document.getElementById('toggle-fullscreen').addEventListener('click', () => {
            const terminalContainer = document.querySelector('.terminal-full-container');
            
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                terminalContainer.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            }
        });
        
        // Process terminal commands
        function processCommand(command) {
            if (!command) return;
            
            // Split command and arguments
            const args = command.trim().split(' ');
            const cmd = args[0].toLowerCase();
            
            switch (cmd) {
                case 'help':
                    terminal.writeln('\x1b[1;33mAvailable commands:\x1b[0m');
                    terminal.writeln('  \x1b[1;32mhelp\x1b[0m - Show this help message');
                    terminal.writeln('  \x1b[1;32mclear\x1b[0m - Clear the terminal');
                    terminal.writeln('  \x1b[1;32mstatus\x1b[0m - Show server status');
                    terminal.writeln('  \x1b[1;32mecho [text]\x1b[0m - Echo text back to terminal');
                    terminal.writeln('  \x1b[1;32mdate\x1b[0m - Show current date and time');
                    terminal.writeln('  \x1b[1;32mls\x1b[0m - List files (simulated)');
                    terminal.writeln('  \x1b[1;32mversion\x1b[0m - Show MCP version');
                    break;
                    
                case 'clear':
                    terminal.clear();
                    break;
                    
                case 'status':
                    terminal.writeln('\x1b[1;32mServer status: Running\x1b[0m');
                    terminal.writeln(`Connected clients: ${socket.connected ? '1' : '0'}`);
                    break;
                    
                case 'echo':
                    terminal.writeln(args.slice(1).join(' '));
                    break;
                    
                case 'date':
                    terminal.writeln(new Date().toLocaleString());
                    break;
                    
                case 'ls':
                    terminal.writeln('\x1b[1;34mpublic/\x1b[0m');
                    terminal.writeln('\x1b[1;34msrc/\x1b[0m');
                    terminal.writeln('server.js');
                    terminal.writeln('package.json');
                    terminal.writeln('README.md');
                    break;
                    
                case 'version':
                    terminal.writeln('MCP Server v1.0.0');
                    terminal.writeln('Xterm.js v5.3.0');
                    break;
                    
                default:
                    // Send command to server
                    socket.emit('terminalCommand', command);
                    
                    // Listen for response
                    socket.once('terminalResponse', (response) => {
                        terminal.writeln(response.output);
                        terminal.write('\x1b[1;36m> \x1b[0m');
                    });
                    
                    // Also show a fallback message if no response comes
                    setTimeout(() => {
                        terminal.writeln(`\x1b[1;31mCommand not found: ${command}\x1b[0m`);
                        terminal.writeln('Type "\x1b[1;32mhelp\x1b[0m" for available commands.');
                        terminal.write('\x1b[1;36m> \x1b[0m');
                    }, 500);
                    return; // Skip the prompt at the end
            }
            
            terminal.write('\x1b[1;36m> \x1b[0m');
        }
        
        // Listen for terminal responses from server
        socket.on('terminalResponse', (response) => {
            terminal.writeln(response.output);
            terminal.write('\x1b[1;36m> \x1b[0m');
        });
    }
});