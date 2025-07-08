    1  sudo apt-get update
    2  sudo nano /etc/apt/sources.list
    3  wget -q -O- http://www.webmin.com/jcameron-key.asc | sudo apt-key add
    4  sudo apt update
    5  apt list --upgradable
    6  sudo apt install webmin
    7  apt-get update
    8  apt-get install postfix
    9  ifconfig
   10  apt-get install net-tools
   11  ifconfig
   12  APT-GET UPGRADE
   13  apt-get upgrade
   14  do-release-upgrade -d
   15  vi /etc/update-manager/release-upgrades
   16  do-release-upgrade -d
   17  do-release-upgrade 
   18  reboot now
   19  ifconfig
   20  route
   21  ping cnn.com
   22  echo "Test mail from Postfix relay" | mail -s "Test Email" youremail@gmail.com
   23  apt install mailutils
   24  echo "Test mail from Postfix relay" | mail -s "Test Email" adams@accuratefasteners.com
   25  curl ifconfig.me
   26  swaks --to you@gmail.com --from adams@accuratefasteners.com --server accuratefasteners-com.mail.protection.outlook.com --port 25 --tls
   27  apt install swaks
   28  swaks --to you@gmail.com --from adams@accuratefasteners.com --server accuratefasteners-com.mail.protection.outlook.com --port 25 --tls
   29  tail -f /var/log/mail.log 
   30  cd /opt
   31  ls
   32  cd containerd/
   33  ls
   34  cd bin/
   35  ls
   36  cd ..
   37  cd \
   38  ls
   39  nsap
   40  cd snap
   41  ls
   42  cd ..
   43  cd \
   44  ls
   45  cd /home/adam/
   46  ls
   47  cd API
   48  ls
   49  mv /tmp/docker-compose.yml .
   50  ls
   51  mv /tmp/p21-api/ .
   52  ls
   53  docker-compose up -d --build
   54  vi docker-compose.yml 
   55  docker-compose up -d --build
   56  passwd root
   57  vi /etc/ssh/sshd_config
   58  serivce sshd restart
   59  systemctl restart sshd
   60  curl -X POST http://localhost:8000/salesorder   -H "Content-Type: application/json"   -d '{
   61      "customerId": "CUST100",
   62      "items": [
   63        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
   64      ]
   65    }'
   66  curl http://192.168.1.8:8000/item -H "ObWRZrNsdgv5AJIMeb8vZdR0EFI4kKaE"
   67  curl http://192.168.1.8:8000/item
   68  curl http://192.168.1.8:8000/item -H "ObWRZrNsdgv5AJIMeb8vZdR0EFI4kKaE"
   69  curl http://192.168.1.8:8000/item?apikey="ObWRZrNsdgv5AJIMeb8vZdR0EFI4kKaE"
   70  curl http://192.168.1.8:8000/item -H "ObWRZrNsdgv5AJIMeb8vZdR0EFI4kKaE"
   71  curl http://192.168.1.8:8000/item
   72  curl http://192.168.1.8:8000
   73  curl http://192.168.1.8:8000/item
   74  curl http://192.168.1.8:8000/order-status
   75  curl http://192.168.1.8:8000/item
   76  systemctl restart docker
   77  docker-compose up -d
   78  cd /home/adam/API/
   79  dir
   80  docker-compose up -d
   81  docker-compose ps
   82  curl http://192.168.1.8:8000/item
   83  netstat -tlpn
   84  docker start konga
   85  netstat -tlpn
   86  curl http://192.168.1.8:8000/item
   87  docker ps | grep kong
   88  docker restart kong
   89  docker ps | grep kong
   90  docker-compose up -d kong
   91  docker ps | grep kong
   92  systemctl stop docker
   93  docker ps | grep kong
   94  docker restart kong
   95  docker restart konga
   96  netstat -tlpn
   97  curl http://192.168.1.8:8000/item
   98  netstat -tlpn
   99  curl http://192.168.1.8:8000/item
  100  netstat -tlpn
  101  docker ps | grep kong
  102  ocker-compose logs kong
  103  docker-compose logs kong
  104  docker-compose logs konga
  105  docker ps
  106  curl http://192.168.1.8:8001/status
  107  docker-compose up -d kong
  108  curl http://192.168.1.8:8001/status
  109  docker ps | grep kong
  110  docker logs kong
  111  docker-compose run --rm kong-migration
  112  docker-compose restart kong
  113  cd ..
  114  cd P21-API/
  115  docker-compose run --rm kong-migration
  116  docker-compose restart kong
  117  docker-compose restart kong-database
  118  docker-compose restart kong-migration
  119  docker-compose run --rm kong-migration
  120  docker ps | grep kong
  121  docker-compose down
  122  docker ps | grep kong
  123  docker inspect kong | grep -A 10 Networks
  124  docker inspect kong-database | grep -A 10 Networks
  125  docker-compose down
  126  docker-compose up -d --build
  127  docker rm -f kong p21-api mongo kong-database konga kong-migration
  128  docker-compose up -d --build
  129  docker ps -a
  130  docker ps 
  131  netstat -tlpn
  132  docker rm -f kong konga kong-database mongo kong-migration
  133  docker network prune -f
  134  cd ..
  135  docker-compose up -d --build
  136  cd API/
  137  docker-compose up -d --build
  138  docker-compose down
  139  docker-compose up -d --build
  140  curl http://192.168.1.8:8000/item
  141  netstat -tlpn
  142  docker ps | grep p21-api
  143  docker logs -f p21-api
  144  docker-compose down
  145  docker-compose up -d --build
  146  docker rm -f p21-api
  147  docker-compose up -d --build
  148  curl http://192.168.1.8:8000/item
  149  docker-compose restart p21-api
  150  curl http://192.168.1.8:8000/item
  151  docker rm -f p21-api
  152  docker-compose up -d --build
  153  curl http://192.168.1.8:8000/item
  154  docker rm -f p21-api
  155  docker-compose up -d --build
  156  curl http://192.168.1.8:8000/item
  157  docker rm -f p21-api
  158  docker-compose up -d --build
  159  docker rm -f p21-api
  160  docker-compose up -d --build
  161  npm install axios dotenv
  162  npm install npm axios dotenv
  163  npm install npm 
  164  apt  install npm 
  165  npm install axios dotenv
  166  npm install axios dotenv express
  167  node server.js
  168  cd api/
  169  node server.js
  170  cd ..
  171  ls
  172  node server.js
  173  ls
  174  node server.js
  175  node -v
  176  sudo apt update
  177  sudo apt install curl -y
  178  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  179  sudo apt install -y nodejs
  180  node -v
  181  node server.js
  182  docker rm -f p21-api
  183  docker-compose up -d --build
  184  docker ps
  185  docker-compose build p21-api
  186  docker-compose up -d p21-api
  187  curl -X POST http://localhost:8000/salesorder   -H "Content-Type: application/json"   -d '{
  188      "customerId": "CUST100",
  189      "items": [
  190        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  191      ]
  192    }'
  193  netstat -tlpn
  194  docker-compose build p21-api
  195  docker-compose up -d p21-api
  196  curl -X POST http://localhost:8000/salesorder   -H "Content-Type: application/json"   -d '{
  197      "customerId": "CUST100",
  198      "items": [
  199        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  200      ]
  201    }'
  202  curl -X POST http://localhost:8000/salesorder   -H "Content-Type: application/json"   -d '{
  203      "customerId": "CUST100",
  204      "items": [
  205        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  206      ]
  207    }'
  208  docker logs -f p21-api
  209  curl -X POST http://localhost:3000/salesorder   -H "Content-Type: application/json"   -d '{
  210      "customerId": "CUST100",
  211      "items": [
  212        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  213      ]
  214    }'
  215  docker-compose build p21-api
  216  docker-compose up -d p21-api
  217  curl -X POST http://localhost:3000/salesorder   -H "Content-Type: application/json"   -d '{
  218      "customerId": "CUST100",
  219      "items": [
  220        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  221      ]
  222    }'
  223  curl -X POST http://192.168.1.8:3000/salesorder   -H "Content-Type: application/json"   -d '{
  224      "customerId": "CUST100",
  225      "items": [
  226        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  227      ]
  228    }'
  229  curl -X POST http://localhost:3000/salesorder   -H "Content-Type: application/json"   -d '{
  230      "customerId": "CUST100",
  231      "items": [
  232        { "itemId": "WIDGET-100", "qty": 2, "warehouseId": "MAIN" }
  233      ]
  234    }'
  235  netstat -tlpn
  236  docker logs -f p21-api
  237  docker-compose down
  238  docker-compose build
  239  docker-compose up -d
  240  cd /home/adam/API/
  241  ls
  242  cd p21-api/
  243  docker-compose up --build -d
  244  docker ps
  245  curl http://localhost:3000/item?item_id=XYZ
  246  curl -X POST http://localhost:3000/salesorder 
  247  cd ..
  248  cd p21-emulated-sales-order
  249  node index.js 
  250  npm install
  251  node index.js 
  252  npm install
  253  node index.js 
  254  ls
  255  ls -l
  256  node index.js 
  257  npm install
  258  node index.js 
  259  npm install
  260  node index.js
  261  cd ..
  262  cd p21-import/
  263  npm install
  264  node index.js
  265  sudo apt update
  266  sudo apt install apt-transport-https ca-certificates curl software-properties-common
  267  sudo apt upgrade
  268  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
  269  sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
  270  apt-cache policy docker-ce
  271  sudo apt install docker-ce
  272  sudo systemctl status docker
  273  docker
  274  docker info
  275  /opt
  276  mkdir kong-konga-setup && cd kong-konga-setup
  277  nano docker-compose.yml
  278  ls
  279  docker-compose up -d
  280  apt  install docker-compose 
  281  docker-compose up -d
  282  nano docker-compose.yml
  283  docker-compose up -d
  284  nano docker-compose.yml
  285  docker-compose down -v
  286  docker-compose up -d
  287  ping Hi Dean,
  288  Our CFO and COO would like to have a quick demo for AP and bank payment model and disccus what Medius could offer Accurate Group of companies now of in ht future.
  289  ping 192.168.0.253
  290  tail -f /var/log/mail.log 
  291  reboot
  292  tail -f /var/log/mail.log 
  293  cat /var/log/syslog | grep "smtp.*to=.*" | grep -v 250
  294  grep "smtp.*to=.*" /var/log/syslog | grep -v 250
  295  cat /var/log/maillog |grep -v "relay=local" |grep "relay=" |grep "status=sent"
  296  cat /var/log/mail.log | pflogsumm 
  297  apt install pflogsumm
  298  cat /var/log/mail.log | pflogsumm 
  299  netstate -tlpn
  300  history
  301  cd /opt
  302  ls
  303  cd containerd/
  304  ls
  305  cd ..
  306  cd \
  307  dir
  308  docker info
  309  systemctl status docker
  310  cd /var/src
  311  cd /usr/src
  312  wget https://download.configserver.com/csf.tgz
  313  tar -xzf csf.tgz
  314  cd csf
  315  sh install.sh 
  316  csf -v
  317  netstat -tlpn
  318  cd \
  319  cd ..
  320  cd adam
  321  cd home/
  322  ls
  323  cd adam
  324  ls
  325  cd API/
  326  hostory
  327  history
  328  'docker-compose up -d
  329  docker-compose up -d
  330  cd ..
  331  ls
  332  cd p21-import/
  333  dir
  334  docker ps
  335  cd ..
  336  cd API/
  337  docker ps
  338  docker-compose up -d
  339  cd /usr/src/csf
  340  ls
  341  sh uninstall.sh 
  342  cd /home/adam/API/
  343  docker-compose up -d
  344  docker container prune -f
  345  docker network prune -f
  346  docker system prune -af --volumes
  347  systemctl restart docker
  348  ls
  349  docker-compose up -d --build
  350  docker network ls
  351  docker network inspect bridge
  352  docker-compose up -d
  353  docker ps
  354  docker-compose up -d p21-api
  355  docker ps
  356  reboot curl http://192.168.1.8:8001/status
  357  reboot 
  358  docker ps
  359  docker-compose up -d --build
  360  docker-compose up -d 
  361  docker ps
  362  curl "http://192.168.1.8:8000/item?paging=true&order=asc"   -H "apikey: YOUR_API_KEY"
  363  vi docker-compose.yml 
  364  docker-compose down
  365  docker-compose up -d --build
  366  vi docker-compose.yml 
  367  docker-compose up -d --build
  368  docker-compose down
  369  docker-compose up -d --build
  370  docker ps
  371  docker-compose down
  372  docker ps
  373  docker-compose up -d 
  374  docker ps
  375  reboot 
  376  docker ps
  377  curl -X GET "http://192.168.1.8:8001/routes"
  378  curl -X GET "http://192.168.1.8:8001/services"
  379  curl -X GET "http://192.168.1.8:8001/plugins"
  380  history
  381  curl "http://192.168.1.8:8000/item?paging=true&order=asc"   -H "apikey:lZuWiiNgBZmain0kfS72YutacWiYFERk"
  382  curl "http://192.168.1.8:8000/item?paging=true&order=asc" 
  383  cd /home/adam/API/
  384  ls
  385  vi .env 
  386  netstate -tlpn
  387  netstat -tlpn
  388  docker-compose down p21-api
  389  docker-compose down -d
  390  docker-compose down
  391  docker ps
  392  docker-compose up -d 
  393  netstat -tlpn
  394  docker-compose down -v 
  395  docker-compose up -d --build
  396  netstat -tlpn
  397  docker-compose up -d 
  398  netstat -tlpn
  399  docker ps
  400  docker logs kong
  401  sudo chown -R 1000:1000 /var/lib/docker/volumes/kong-logs/_data
  402  docker-compose down -v
  403  docker-compose up -d --build
  404  docker ps
  405  docker-compose down -v
  406  docker-compose up -d 
  407  docker ps
  408  docker exec -it kong ping p21-api
  409  docker ps
  410  docker logs p21-api
  411  docker-compose build p21-api
  412  docker-compose up -d
  413  docker ps
  414  docker logs p21-api
  415  docker-compose up -d
  416  docker ps
  417  docker logs p21-api
  418  docker restart p21-api
  419  docker ps
  420  docker-compose build p21-api
  421  docker-compose up -d
  422  docker ps
  423  docker logs p21-api
  424  docker-compose build p21-api
  425  docker-compose up -d
  426  docker logs p21-api
  427  docker-compose build p21-api
  428  docker-compose up -d
  429  docker ps
  430  docker restart kong
  431  docker-compose down -v
  432  docker volume rm kong-db-data
  433  docker-compose up -d --build
  434  docker ps
  435  netstat -tlpn
  436  docker logs kong
  437  docker-compose up -d 
  438  docker ps
  439  docker logs kong
  440  docker-compose down -v
  441  docker volume rm kong-db-data
  442  docker volume rm kong-database
  443  docker-compose up -d --build
  444  docker ps
  445  vi /usr/local/bin/kong-backup.sh
  446  sudo /usr/local/bin/kong-backup.sh
  447  vi /usr/local/bin/kong-backup.sh
  448  chmod +x /usr/local/bin/kong-backup.sh
  449  /usr/local/bin/kong-backup.sh
  450  crontab -e
  451  cd ..
  452  docker exec kong kong config db_export /tmp/kong-backup.yaml
  453  docker cp kong:/tmp/kong-backup.yaml ./kong-backup.yaml
  454  ls
  455  curl http://192.168.1.8:8000/inventory
  456  cd API/
  457  docker-compose build p21-api
  458  docker-compose up -d
  459  curl http://192.168.1.8:8000/inventory
  460  curl "http://192.168.1.8:8000/inventory?paging=true&page=2&limit=50"
  461  docker ps
  462  docker logs p21-api
  463  docker-compose build p21-api
  464  docker-compose up -d
  465  docker ps
  466  curl "http://192.168.1.8:8000/inventory?paging=true&page=2&limit=50"
  467  cd API/
  468  docker ps
  469  docker-compose up -d 
  470  docker ps
  471  cd..
  472  ls
  473  vi docker-compose.yml
  474  docker-compose down
  475  docker-compose up -d
  476  curl "http://192.168.1.8:9000/item?paging=true&order=asc"
  477  ls
  478  cdhown -R adam:adam *.*
  479  chown -R adam:adam *.*
  480  chown -R adam:adam p21-api/
  481  docker restart kong
  482  docker-compose down
  483  docker-compose up -d
  484  cd ..
  485  ls
  486  cd ..
  487  ls
  488  vi freshworks.py
  489  python freshworks.py 
  490  python3 freshworks.py 
  491  vi freshworks.py
  492  python3 freshworks.py 
  493  vi freshworks.py
  494  python3 freshworks.py 
  495  curl -u YOUR_API_KEY:X -H "Content-Type: application/json" "https://yourdomain.freshservice.com/api/v2/requesters/34001203271"
  496  curl -u 'Qe1S5bF1chqRzG8mp6ht':X -H "Content-Type: application/json" "https://accuratefasteners.freshservice.com/api/v2/requesters/34001203271"
  497  vi freshworks.py
  498  python3 freshworks.py 
  499  vi freshworks.py
  500  python3 freshworks.py 
  501  history
  502  tail -f /var/log/mail.log
  503  curl "http://192.168.1.8:9000/item?paging=true&order=asc"
  504  netstat -tlpn
  505  sudo apt install certbot python3-certbot-nginx -y
  506  sudo certbot --nginx -d api.accuratefasteners.com
  507  ping api.accuratefasteners.com
  508  vi /etc/hosts
  509  ping api.accuratefasteners.com
  510  sudo certbot --nginx -d api.accuratefasteners.com
  511  ping api.accuratefasteners.com
  512  vi /etc/hosts
  513  ping api.accuratefasteners.com
  514  sudo certbot --nginx -d api.accuratefasteners.com
  515  netstat -tlpn
  516  systemctl stop nginx
  517  sudo certbot --nginx -d api.accuratefasteners.com
  518  netstat -tlpn
  519  nano /etc/nginx/sites-available/api
  520  systemctl reload nginx
  521  systemctl start nginx
  522  nano /etc/nginx/sites-available/api
  523  systemctl start nginx
  524  journalctl -xe
  525  netstat -tlpn
  526  systemctl restart nginx
  527  ngiinx -t
  528  nginx -t
  529  cd /opt
  530  ls
  531  cd containerd/
  532  ls
  533  cd ..
  534  cd kong-backups/
  535  ls
  536  cd \
  537  ls
  538  cd snap/
  539  ls
  540  cd ..
  541  history
  542  cd /home/adam/
  543  ls
  544  reboot now
  545  netstat -tlpn
  546  cd API/
  547  ls
  548  history > h
