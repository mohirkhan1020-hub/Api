import argparse
import sys

def scan_files(files):
    """এখানে আপনার আসল স্ক্যানিং লজিক বসবে। আপাতত এটি শুধু ফাইলের নাম প্রিন্ট করবে।"""
    for f in files:
        if not f.strip():
            continue
        print(f"[SCAN SUCCESS] ফাইলটি পাওয়া গেছে এবং স্ক্যান করা হচ্ছে: {f}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--added", default="")
    parser.add_argument("--modified", default="")
    args = parser.parse_args()

    # কমা দিয়ে আলাদা করা ফাইলের নামগুলোকে লিস্টে রূপান্তর
    added = [f for f in args.added.split(",") if f.strip()]
    modified = [f for f in args.modified.split(",") if f.strip()]

    if not added and not modified:
        print("কোনো টার্গেট ফাইল পাওয়া যায়নি।")
        sys.exit(0)

    print("--- স্ক্যানিং শুরু হচ্ছে ---")
    scan_files(added + modified)
    print("--- স্ক্যানিং শেষ ---")

if __name__ == "__main__":
    main()
