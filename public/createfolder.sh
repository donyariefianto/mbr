#ls
#!/bin/sh
#camserver=http://192.168.1.108/cgi-bin/snapshot.cgi?1
camserver=http://192.168.2.222/cgi-bin/snapshot.cgi?1
dirimg=snapshots/$(date "+%d%m%y")
host_andanu=https://103.135.14.146/airpointer/api
host_local=http://192.168.2.17
dir=/d/Kerja/enygma-mobiair/public/snapshots/$(date "+%d%m%y")/
# dir=/home/enygma/enygma-mobiair/public/snapshots/$(date "+%d%m%y")/
#timenow=$(date +%s)
timenow=$(date +%s -d '2 minute ago');
if [ -d "$dir" ]; then
        #echo "ada $dir"
        (curl --location --request POST "$host_andanu/pushData" \--form "img=$dirimg/$timenow.jpg")
        # (curl --location --request POST "$host_local/pushData" \--form "img=$dirimg/$timenow.jpg")
        (curl --user "admin:admin1234" "$camserver" --digest -o "$dir$timenow".jpg -s)  
        curl --location --request POST "$host_andanu/simpanGambar" \
        --header 'Cookie: XSRF-TOKEN=8845f5373a925d04c1742ae24a421535j%2FC2FeeHYYECGsBUPUlb3%2Bul6H1WhqzBtzUZS%2B7Wr%2FsuPSGJUMKx10qxAp8VrFEajAMyZDh4M%2BQM%2F73%2' --form "names=$timenow" \
        --form "img=@$dir$timenow".jpg

else
        mkdir "$dir"
        (curl --location --request POST "$host_andanu/pushData" \--form "img=$dirimg/$timenow.jpg")
        # (curl --location --request POST "$host_local/pushData" \--form "img=$dirimg/$timenow.jpg")      
        (curl --user "admin:admin1234" "$camserver" --digest -o "$dir$timenow".jpg -s)  
        curl --location --request POST "$host_andanu/simpanGambar" \
        --header 'Cookie: XSRF-TOKEN=8845f5373a925d04c1742ae24a421535j%2FC2FeeHYYECGsBUPUlb3%2Bul6H1WhqzBtzUZS%2B7Wr%2FsuPSGJUMKx10qxAp8VrFEajAMyZDh4M%2BQM%2F73%2>' --form "names=$timenow" \
        --form "img=@$dir$timenow".jpg

fi