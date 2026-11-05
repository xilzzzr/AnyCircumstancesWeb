import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { privateInputProps } from "@/lib/privateInputProps";
import { phraseWords, type WalletRecovery } from "@/lib/vaultDocuments";

function SecretInput({
  id,
  label,
  value,
  onChange,
  maxLength = 8000,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hide = () => setShow(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...privateInputProps}
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-controls={id}
        aria-pressed={show}
        onClick={() => setShow(!show)}
      >
        {show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      </Button>
    </div>
  );
}

export function WalletRecoveryFields({
  wallet,
  onChange,
}: {
  wallet: WalletRecovery;
  onChange: (wallet: WalletRecovery) => void;
}) {
  const change = (patch: Partial<WalletRecovery>) =>
    onChange({ ...wallet, ...patch });
  const field = (
    key: keyof Omit<WalletRecovery, "phrases">,
    label: string,
    help: string,
    multiline = false,
    required = false,
  ) => {
    const Component = multiline ? Textarea : Input;
    return (
      <div className="space-y-2" key={key}>
        <Label htmlFor={`wallet-${key}`}>{label}</Label>
        <p id={`wallet-${key}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
        <Component
          {...privateInputProps}
          id={`wallet-${key}`}
          aria-describedby={`wallet-${key}-help`}
          value={wallet[key]}
          onChange={(e) => change({ [key]: e.target.value })}
          maxLength={8000}
          required={required}
        />
      </div>
    );
  };
  return (
    <div
      data-private
      data-hj-suppress
      data-clarity-mask="true"
      data-sentry-mask
      className="space-y-5 ph-no-capture"
    >
      <div className="rounded-xl border p-4 text-sm space-y-2">
        <p>
          Anyone with these words and any required wallet passphrase may control
          your funds. Consider leaving instructions to an offline backup instead
          of storing the words online.
        </p>
        <p>
          Use a label for the document title. Never put recovery words or other
          secrets in the title, which appears in file lists.
        </p>
        <p>
          Record an existing backup here. This form does not generate or verify
          a wallet, its words, checksum, or balance.
        </p>
      </div>
      {field(
        "walletApp",
        "Wallet app or hardware device",
        "Include the original app/device name and version if known, such as Ledger with Ledger Live or Electrum.",
        false,
        true,
      )}
      {field(
        "networks",
        "Networks and assets",
        "List every network and asset to recover, including custom networks, tokens, or NFTs. The same words can be used on several networks.",
        true,
        true,
      )}
      <div className="space-y-2">
        <Label htmlFor="wallet-format">Backup format</Label>
        <select
          id="wallet-format"
          className="w-full rounded-md border bg-background p-2"
          value={wallet.backupFormat}
          onChange={(e) => {
            if (
              wallet.phrases.length > 1 &&
              !["slip39", "other"].includes(e.target.value)
            ) {
              if (
                !window.confirm(
                  "Changing the format will remove additional recovery shares. Continue?",
                )
              )
                return;
              change({
                backupFormat: e.target.value as WalletRecovery["backupFormat"],
                phrases: [wallet.phrases[0]],
              });
            } else
              change({
                backupFormat: e.target.value as WalletRecovery["backupFormat"],
              });
          }}
        >
          <option value="unknown">Not sure</option>
          <option value="bip39">BIP39 (12, 15, 18, 21, or 24 words)</option>
          <option value="slip39">SLIP39 (20 or 33 words per share)</option>
          <option value="electrum">Electrum native backup</option>
          <option value="other">Other format</option>
        </select>
      </div>
      {field(
        "phraseLanguage",
        "Recovery word language (optional)",
        "For example, English. Do not translate or reorder the original words.",
      )}
      {wallet.phrases.map((phrase, i) => (
        <section key={i} className="rounded-xl border p-4 space-y-2">
          <SecretInput
            id={`wallet-phrase-${i}`}
            label={
              wallet.phrases.length > 1
                ? `Recovery share ${i + 1}`
                : "Recovery phrase"
            }
            value={phrase}
            maxLength={4000}
            onChange={(value) =>
              change({
                phrases: wallet.phrases.map((p, j) => (j === i ? value : p)),
              })
            }
          />
          <p className="text-sm text-muted-foreground">
            {phraseWords(phrase).length} words. Enter words in their original
            order, separated by spaces, without numbering. Word count alone does
            not verify the backup.
          </p>
          {wallet.phrases.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm("Remove this recovery share?"))
                  change({ phrases: wallet.phrases.filter((_, j) => j !== i) });
              }}
            >
              Remove share {i + 1}
            </Button>
          )}
        </section>
      ))}
      {["slip39", "other"].includes(wallet.backupFormat) && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            For a shared backup, record its group and member thresholds and
            where any other shares are kept below. Storing enough shares
            together removes the protection of keeping them separate.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={wallet.phrases.length >= 16}
            onClick={() => change({ phrases: [...wallet.phrases, ""] })}
          >
            Add another recovery share
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="wallet-passphrase-status">
          Does this wallet use an additional recovery passphrase?
        </Label>
        <p className="text-sm text-muted-foreground">
          Sometimes called a hidden-wallet passphrase or 25th word. This is
          separate from your AnyCircumstances vault passphrase and device PIN. A
          different passphrase can open a different, empty wallet.
        </p>
        <select
          id="wallet-passphrase-status"
          className="w-full rounded-md border bg-background p-2"
          value={wallet.passphraseStatus}
          onChange={(e) =>
            change({
              passphraseStatus: e.target
                .value as WalletRecovery["passphraseStatus"],
              passphrase: "",
              passphraseLocation: "",
            })
          }
        >
          <option value="unknown">Not confirmed</option>
          <option value="none">No additional recovery passphrase</option>
          <option value="separate">Yes, kept separately</option>
          <option value="included">Yes, include it in this document</option>
        </select>
        {wallet.passphraseStatus === "unknown" && (
          <p className="text-sm text-muted-foreground">
            Check this with the original wallet. Missing a required passphrase
            can prevent recovery.
          </p>
        )}
      </div>
      {wallet.passphraseStatus === "included" && (
        <>
          <SecretInput
            id="wallet-passphrase"
            label="Exact wallet recovery passphrase"
            value={wallet.passphrase}
            onChange={(passphrase) => change({ passphrase })}
          />
          <p className="text-sm text-muted-foreground">
            Preserve capitalization and every space. Keeping words and the
            passphrase together means anyone who receives this document has
            both.
          </p>
        </>
      )}
      {wallet.passphraseStatus === "separate" &&
        field(
          "passphraseLocation",
          "Where to find the wallet passphrase",
          "Give the recipient enough information to obtain it when you are unavailable.",
          true,
          true,
        )}
      <details className="rounded-xl border p-4 space-y-4">
        <summary className="cursor-pointer font-medium">
          Account paths, device access, and special recovery requirements
        </summary>
        <p className="text-sm text-muted-foreground">
          Fill in what your wallet requires. An exchange account, imported
          private-key account, smart account, or multisig wallet may need more
          than a seed phrase. Describe or attach its separate backups and
          signers.
        </p>
        {field(
          "derivationPaths",
          "Derivation paths (if known)",
          "List each network/account path exactly as shown by the original wallet. Do not guess a default.",
          true,
        )}
        {field(
          "accountIndexes",
          "Account numbers and address indexes (optional)",
          "Include account names/numbers, address indexes, and change or receiving branches if relevant.",
          true,
        )}
        {field(
          "addressType",
          "Address or script type (optional)",
          "For example, Bitcoin legacy, nested SegWit, native SegWit, or Taproot.",
        )}
        {field(
          "expectedAddresses",
          "Known receiving addresses (optional)",
          "List an address for each account/network so the recipient can verify they recovered the right wallet.",
          true,
        )}
        <SecretInput
          id="wallet-password"
          label="Local wallet or backup-file password (optional)"
          value={wallet.walletPassword}
          onChange={(walletPassword) => change({ walletPassword })}
        />
        <SecretInput
          id="wallet-device"
          label="Original device PIN or access instructions (optional)"
          value={wallet.deviceAccess}
          onChange={(deviceAccess) => change({ deviceAccess })}
        />
        <p className="text-sm text-muted-foreground">
          These may unlock an existing device or encrypted backup file. They are
          not normally a substitute for the recovery words or an additional
          recovery passphrase.
        </p>
        {field(
          "configuration",
          "Multi-share or multisig recovery configuration (optional)",
          "Include share/group thresholds and locations, or multisig quorum, cosigner key origins/xpubs, descriptors or policy backup location, and signer access requirements.",
          true,
        )}
      </details>
      {field(
        "instructions",
        "Recovery steps and other requirements (optional)",
        "Explain which genuine wallet/device to use, how to locate other backups, custom network/chain IDs and token details, and any accounts or assets not covered by these words. Verify your backup using the wallet manufacturer's own procedure.",
        true,
      )}
    </div>
  );
}
