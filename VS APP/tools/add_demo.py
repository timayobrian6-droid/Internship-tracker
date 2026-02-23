import urllib.request
import json

def post_demo():
    url = 'http://127.0.0.1:5000/api/internships'
    payload = {'company': 'Acme', 'position': 'Intern'}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        print('POST ->', r.getcode())
        print(r.read().decode())

def get_list():
    url = 'http://127.0.0.1:5000/api/internships'
    with urllib.request.urlopen(url) as r:
        print('GET ->')
        print(r.read().decode())

if __name__ == '__main__':
    post_demo()
    get_list()
