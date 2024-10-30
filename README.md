# PAWS Auto Quest

An automated client for managing PAWS accounts and completing daily quests. This tool helps users manage multiple PAWS accounts efficiently by automating various tasks such as quest completion, wallet linking, and allocation tracking.

## Features

- Automatic quest completion
- Automatic wallet linking
- Allocation tracking
- Claim streak monitoring
- Token management
- Multi-account support

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Galkurta/Paws-BOT.git
cd Paws-BOT
```

2. Install dependencies:

```bash
npm install
```

## Configuration

1. Register your PAWS account by clicking [here](https://t.me/PAWSOG_bot/PAWS?startapp=vuY5ILO1)

2. Edit necessary files in the project directory:

   - `data.txt`: Store your PAWS initialization data
   - `wallet.txt`: Store your wallet addresses

### File Format

**data.txt**:

```plaintext
user=
query_id=
```

(One initialization data per line)

**wallet.txt**:

```plaintext
UQC20...
```

(One wallet address per line)

> **Note**: The number of entries in `data.txt` and `wallet.txt` must match.

## Usage

Run the application:

```bash
node main.js
```

The application will:

1. Process each account sequentially
2. Complete available quests
3. Link wallets if necessary
4. Monitor claim streaks
5. Track allocations
6. Wait 24 hours before starting the next cycle

## Output Information

The tool provides detailed information about:

### Account Information

- Username
- Current balance

### Claim Streak Information

- Current streak count
- Last claim timestamp

### Allocation Information

- Hamster allocations
- Telegram details
- PAWS conversions
- Dogs allocations
- Notcoin data
- Total allocation

### Wallet Information

- Wallet linking status
- Current linked wallet

## Error Handling

The application includes robust error handling for:

- API communication issues
- File reading/writing errors
- Token validation
- Quest completion failures

## File Structure

```
Paws-BOT/
├── config/
│   ├── logger.js
│   └── banner.js
├── main.js
├── data.txt
├── wallet.txt
└── token.json (auto-generated)
```

## Security Considerations

- Never share your initialization data
- Keep your wallet.txt and data.txt secure
- Regularly backup your token.json file

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This tool is for educational purposes only. Use at your own risk. Make sure to comply with PAWS's terms of service while using this tool.

## Support

If you encounter any issues or have questions, please open an issue in the repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
