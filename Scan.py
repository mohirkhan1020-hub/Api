import argparse
import sys


def scan_files(files):
    """আপনার আসল স্ক্যানিং লজিক এখানে বসান।"""
    for f in files:
        if not f.strip():
            continue
        print(f"[SCAN] {f}")
        # উদাহরণ: ফাইল ওপেন করে চেক করা
        # with open(f) as fp:
        #     content = fp.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--added", default="")
    parser.add_argument("--modified", default="")
    args = parser.parse_args()

    added = [f for f in args.added.split(",") if f.strip()]
    modified = [f for f in args.modified.split(",") if f.strip()]

    if not added and not modified:
        print("কোনো টার্গেট ফাইল পাওয়া যায়নি।")
        sys.exit(0)

    scan_files(added + modified)


if __name__ == "__main__":
    main()
